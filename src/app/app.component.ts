import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ServiceApiService } from './services/service-api.service';
import { ColumnInfo, EntityInfo, ExportFormat, RowsResponse } from './services/service.model';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  private api = inject(ServiceApiService);

  // ----- state -----
  entities       = signal<EntityInfo[]>([]);
  selectedEntity = signal<string>('');
  columns        = signal<ColumnInfo[]>([]);
  selectedCols   = signal<Set<string>>(new Set<string>());
  format         = signal<ExportFormat>('excel');
  rows           = signal<Record<string, any>[]>([]);
  totalRows      = signal<number>(0);
  loading        = signal(false);
  exporting      = signal(false);
  errorMsg       = signal<string | null>(null);
  searchTerm     = signal('');

  // ----- derived -----
  selectedCount = computed(() => this.selectedCols().size);
  allSelected   = computed(() =>
    this.columns().length > 0 &&
    this.columns().every(c => this.selectedCols().has(c.field))
  );

  filteredRows = computed(() => {
    const q = this.searchTerm().toLowerCase().trim();
    if (!q) return this.rows();

    return this.rows().filter(r =>
      Object.values(r).some(v =>
        v !== null && v !== undefined && String(v).toLowerCase().includes(q)
      )
    );
  });

  ngOnInit(): void {
    this.loadEntities();
  }

  // ----- loaders -----
  loadEntities() {
    this.api.listEntities().subscribe({
      next: list => {
        this.entities.set(list);
        if (list.length > 0) {
          // Default to "Service" if present, else first entity
          const def = list.find(e => e.name === 'Service') ?? list[0];
          this.selectEntity(def.name);
        }
      },
      error: err => this.errorMsg.set('Failed to load entities: ' + err.message)
    });
  }

  selectEntity(name: string) {
    this.selectedEntity.set(name);
    this.searchTerm.set('');
    this.loadColumnsAndRows(name);
  }

  loadColumnsAndRows(entity: string) {
    this.loading.set(true);

    this.api.getColumns(entity).subscribe({
      next: cols => {
        this.columns.set(cols);
        // Pre-select the first 5 columns (or fewer)
        const defaults = cols.slice(0, 5).map(c => c.field);
        this.selectedCols.set(new Set(defaults));
      },
      error: err => this.errorMsg.set('Failed to load columns: ' + err.message)
    });

    this.api.getRows(entity, 100, 0).subscribe({
      next: (res: RowsResponse) => {
        this.rows.set(res.items);
        this.totalRows.set(res.total);
        this.loading.set(false);
      },
      error: err => {
        this.errorMsg.set('Failed to load rows: ' + err.message);
        this.loading.set(false);
      }
    });
  }

  // ----- column actions -----
  toggleColumn(field: string) {
    const next = new Set(this.selectedCols());
    if (next.has(field)) next.delete(field); else next.add(field);
    this.selectedCols.set(next);
  }

  toggleSelectAll() {
    if (this.allSelected()) this.selectedCols.set(new Set());
    else this.selectedCols.set(new Set(this.columns().map(c => c.field)));
  }

  setFormat(fmt: ExportFormat) {
    this.format.set(fmt);
  }

  // ----- export -----
  download() {
    if (this.selectedCount() === 0) {
      this.errorMsg.set('Please select at least one column.');
      return;
    }
    if (!this.selectedEntity()) {
      this.errorMsg.set('Please select an entity.');
      return;
    }

    this.errorMsg.set(null);
    this.exporting.set(true);

    const cols = Array.from(this.selectedCols());
    this.api.export({
      entity: this.selectedEntity(),
      columns: cols,
      format: this.format()
    }).subscribe({
      next: blob => {
        const ext = this.format() === 'excel' ? 'xlsx'
                   : this.format() === 'pdf' ? 'pdf' : 'csv';
        const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '');
        this.triggerDownload(blob, `${this.selectedEntity()}_${stamp}.${ext}`);
        this.exporting.set(false);
      },
      error: err => {
        this.errorMsg.set('Export failed: ' + (err.message || 'Unknown error'));
        this.exporting.set(false);
      }
    });
  }

  private triggerDownload(blob: Blob, fileName: string) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  // ----- helpers used in template -----
  isSelected = (field: string) => this.selectedCols().has(field);

  cellValue(row: Record<string, any>, field: string): string {
    const v = row[field];
    if (v === null || v === undefined) return '';
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
      const d = new Date(v);
      return d.getHours() === 0 && d.getMinutes() === 0
        ? d.toISOString().slice(0, 10)
        : d.toISOString().slice(0, 16).replace('T', ' ');
    }
    return String(v);
  }
}
