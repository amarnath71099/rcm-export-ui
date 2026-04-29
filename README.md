# RCM Import — Workbook Export (UI + API)

Two projects that work together so a user can pick **any entity** from the RCM Import workbook (Tenant, Company, Client, Employee, GroupPayor, GroupPayorService, ClearingHouse, Service, StartOfCare, Certification, Authorization, Visit, Timesheet), choose columns, and download in **Excel**, **CSV**, or **PDF**.

```
outputs/
├── RcmExportApi/        ← .NET 9 Web API (loads RCM_Import.xlsx into memory)
└── rcm-export-ui/       ← Angular 19 UI (Bootstrap 5)
```

---

## Architecture (after refactor for full workbook)

The API loads `Data/RCM_Import.xlsx` once at startup into an in-memory store and exposes a generic, dynamic API:

```
GET  /api/entities                     → list all 13 entities + row counts + columns
GET  /api/entities/{name}/columns      → columns for one entity
GET  /api/entities/{name}/rows         → paged preview rows
POST /api/entities/export              → export selected columns as csv/excel/pdf
```

**Why not SQLite + EF Core anymore?** With 13 sheets of varying schemas, defining 13 EF Core entity classes adds a lot of boilerplate for read-only data. The in-memory store is one file (`Services/ExcelDataStore.cs`) and supports every sheet automatically. If you need persistence later, swap in EF Core or any DB — only `ExcelDataStore` would change.

---

## Prerequisites

| Tool | Version | Check |
|---|---|---|
| .NET SDK | 9.0+ | `dotnet --version` |
| Node.js | 20.x+ | `node --version` |
| Angular CLI | 19.x | `npm i -g @angular/cli@19` |

---

## 1. Run the API

```bash
cd RcmExportApi
dotnet restore
dotnet run
```

On startup the API reads `Data/RCM_Import.xlsx` and logs each loaded sheet, e.g.:

```
info: Loaded entity 'Tenant' — 1000 rows × 7 cols.
info: Loaded entity 'Company' — 9999 rows × 14 cols.
info: Loaded entity 'Client' — 10000 rows × 25 cols.
...
```

The API listens on **http://localhost:5001**, with Swagger UI at **/swagger**.

### Sample export request

```http
POST http://localhost:5001/api/entities/export
Content-Type: application/json

{
  "entity":  "Service",
  "columns": ["externalId", "serviceCode", "serviceName", "netRate", "status"],
  "format":  "excel"
}
```

Response: a `.xlsx` file streamed back with the selected columns and **all** rows from that sheet.

---

## 2. Run the UI

```bash
cd rcm-export-ui
npm install
npm start
```

Open **http://localhost:4200**.

What you'll see:
1. A row of **entity pills** at the top — Tenant, Company, Client, Employee, GroupPayor, etc. — each showing its row count.
2. Click an entity → the column list and data preview update for that sheet.
3. **Left panel** — column checkboxes (Select All) + format buttons (Excel / CSV / PDF) + Download.
4. **Right panel** — searchable preview of the first 100 rows.

The Download button shows `Download N rows` so you know what's coming.

---

## Project structure

```
RcmExportApi/
├── Controllers/ServicesController.cs    # /api/entities/* endpoints
├── Data/
│   └── RCM_Import.xlsx                  # full workbook (13 sheets)
├── Models/
│   ├── EntityInfo.cs                    # EntityInfo, ColumnInfo records
│   └── ExportRequest.cs                 # POST body DTO
├── Services/
│   ├── ExcelDataStore.cs                # loads workbook → in-memory dict
│   └── ExportService.cs                 # Excel/CSV/PDF generation (generic)
├── Program.cs                           # DI, CORS, eager-load the store
├── appsettings.json
└── RcmExportApi.csproj                  # ClosedXML, CsvHelper, QuestPDF

rcm-export-ui/
├── src/
│   ├── app/
│   │   ├── services/
│   │   │   ├── service.model.ts         # EntityInfo, ColumnInfo, ExportRequest
│   │   │   └── service-api.service.ts   # listEntities, getColumns, getRows, export
│   │   ├── app.component.ts             # signals: entity, columns, rows, format
│   │   ├── app.component.html           # entity pills + checklist + preview
│   │   ├── app.component.scss
│   │   └── app.config.ts
│   ├── index.html
│   ├── main.ts
│   └── styles.scss
├── angular.json
├── tsconfig.json
└── package.json
```

---

## NuGet packages used

| Format | Package | Why |
|---|---|---|
| Excel `.xlsx` (read + write) | **ClosedXML** | Reads the workbook AND generates Excel exports |
| CSV | **CsvHelper** | Industry standard, handles quoting/escaping |
| PDF | **QuestPDF** | Modern fluent API, free for community use |

---

## How the export works

```
[Angular UI]                              [.NET 9 API]
 user picks entity   ──GET  /entities   ─►  list 13 entities (in-memory)
 user picks cols     ──GET  /columns    ─►  return that sheet's columns
 user clicks DL      ──POST /export     ─►  fmt switch:
                                            excel → ClosedXML
                                            csv   → CsvHelper
                                            pdf   → QuestPDF
 browser download    ◄── file blob ────    return File(bytes, mime, name)
```

Sheets that are loaded as entities: every sheet **except** `Instructions`, `CSV_Export`, and `Lookups` (those are documentation/helper sheets, not data).

Columns starting with `_display_` are filtered out automatically (they're UI-only helper columns in the workbook).

---

## Common issues

**CORS error in the browser console**
The API allows `http://localhost:4200` only. If your UI runs on a different port, edit `Program.cs` → `WithOrigins(...)`.

**"Workbook not found"**
The workbook path defaults to `Data/RCM_Import.xlsx` next to the binary. Override with `Workbook:Path` in `appsettings.json` if you keep the file elsewhere.

**Port already in use**
- API: `Properties/launchSettings.json`
- UI: `angular.json` → `serve.options.port`

**Want to add a new sheet?**
Just add the sheet to `RCM_Import.xlsx` with a header row — the API picks it up automatically on next start. No code changes.
