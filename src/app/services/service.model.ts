export interface ColumnInfo {
  field: string;
  label: string;
}

export interface EntityInfo {
  name: string;
  rowCount: number;
  columns: ColumnInfo[];
}

export interface RowsResponse {
  total: number;
  skip: number;
  take: number;
  items: Record<string, any>[];
}

export type ExportFormat = 'csv' | 'excel' | 'pdf';

export interface ExportRequest {
  entity: string;
  columns: string[];
  format: ExportFormat;
}
