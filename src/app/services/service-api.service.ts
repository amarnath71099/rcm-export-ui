import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ColumnInfo, EntityInfo, ExportRequest, RowsResponse } from './service.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ServiceApiService {
  private http = inject(HttpClient);

  /** API base URL — wired via environments/environment.*.ts */
  private readonly baseUrl = environment.apiUrl;

  /** List every entity (sheet) loaded from the workbook. */
  listEntities(): Observable<EntityInfo[]> {
    return this.http.get<EntityInfo[]>(this.baseUrl);
  }

  /** Get the columns for one entity. */
  getColumns(entity: string): Observable<ColumnInfo[]> {
    return this.http.get<ColumnInfo[]>(`${this.baseUrl}/${encodeURIComponent(entity)}/columns`);
  }

  /** Get a paged slice of rows for preview. */
  getRows(entity: string, take = 100, skip = 0): Observable<RowsResponse> {
    const params = new HttpParams().set('take', take).set('skip', skip);
    return this.http.get<RowsResponse>(
      `${this.baseUrl}/${encodeURIComponent(entity)}/rows`,
      { params }
    );
  }

  /** Export selected columns as a binary blob (browser download). */
  export(req: ExportRequest): Observable<Blob> {
    return this.http.post(`${this.baseUrl}/export`, req, { responseType: 'blob' });
  }
}
