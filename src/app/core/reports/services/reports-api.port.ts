import { Observable } from 'rxjs';
import { ReportExportFormat, ReportsData } from '../models/reports.models';

export abstract class ReportsApiPort {
  abstract load(): Observable<ReportsData>;
  abstract exportReport(format: ReportExportFormat): Observable<void>;
  abstract generateReport(): Observable<void>;
}
