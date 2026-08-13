import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { DataQualityApiPort } from './dataquality-api.port';
import { DataQualityData, QualityRuleRow } from '../models/dataquality.models';

@Injectable({ providedIn: 'root' })
export class MockDataQualityApiService extends DataQualityApiPort {
  private rules: QualityRuleRow[] = [
    { id: 'r1', code: 'missing_coordinates', nameKey: 'dataquality.rule.missing_coordinates.name', descriptionKey: 'dataquality.rule.missing_coordinates.desc', icon: 'ti-map-pin-off', enabled: true, impactedCount: 2318 },
    { id: 'r2', code: 'duplicate_coordinate', nameKey: 'dataquality.rule.duplicate_coordinate.name', descriptionKey: 'dataquality.rule.duplicate_coordinate.desc', icon: 'ti-copy', enabled: true, impactedCount: 1245 },
    { id: 'r3', code: 'inconsistent_street', nameKey: 'dataquality.rule.inconsistent_street.name', descriptionKey: 'dataquality.rule.inconsistent_street.desc', icon: 'ti-signpost', enabled: true, impactedCount: 987 },
    { id: 'r4', code: 'out_of_boundary', nameKey: 'dataquality.rule.out_of_boundary.name', descriptionKey: 'dataquality.rule.out_of_boundary.desc', icon: 'ti-map-off', enabled: true, impactedCount: 612 },
    { id: 'r5', code: 'missing_building_type', nameKey: 'dataquality.rule.missing_building_type.name', descriptionKey: 'dataquality.rule.missing_building_type.desc', icon: 'ti-building', enabled: true, impactedCount: 2104 },
  ];

  private data(): DataQualityData {
    return {
      kpis: {
        coverageRate: 92.4, coverageDelta: 3.2,
        accuracyScore: 96.7, accuracyDelta: 2.1,
        duplicateRate: 1.3, duplicateDelta: -0.4,
        openCases: 86, openCasesDelta: -9,
      },
      rules: this.rules,
      alerts: [
        { id: 'a1', issueTypeKey: 'dataquality.issue.duplicate_candidate', severity: 'high', quartier: 'Djibouti', ruleTriggeredKey: 'dataquality.trigger.duplicate_detected', impactedRecords: 1245, assignedReviewer: 'Fatouma A.', status: 'in_review' },
        { id: 'a2', issueTypeKey: 'dataquality.issue.missing_coordinates', severity: 'high', quartier: 'Arta', ruleTriggeredKey: 'dataquality.trigger.coordinates_missing', impactedRecords: 2318, assignedReviewer: 'Ibrahim H.', status: 'new' },
        { id: 'a3', issueTypeKey: 'dataquality.issue.inconsistent_street', severity: 'medium', quartier: 'Dikhil', ruleTriggeredKey: 'dataquality.trigger.street_standardization', impactedRecords: 987, assignedReviewer: 'Khadija M.', status: 'in_review' },
        { id: 'a4', issueTypeKey: 'dataquality.issue.out_of_boundary', severity: 'high', quartier: 'Obock', ruleTriggeredKey: 'dataquality.trigger.outside_boundary', impactedRecords: 612, assignedReviewer: 'Youssouf D.', status: 'in_review' },
        { id: 'a5', issueTypeKey: 'dataquality.issue.missing_building_type', severity: 'low', quartier: 'Tadjourah', ruleTriggeredKey: 'dataquality.trigger.building_type_required', impactedRecords: 2104, assignedReviewer: 'Amina R.', status: 'new' },
      ],
      regionCoverage: [
        { region: 'Djibouti', coveragePct: 96.5 },
        { region: 'Arta', coveragePct: 92.1 },
        { region: 'Dikhil', coveragePct: 88.3 },
        { region: 'Tadjourah', coveragePct: 84.7 },
        { region: 'Obock', coveragePct: 78.6 },
      ],
      duplicates: [
        { id: 'd1', kind: 'spatial', addressA: '12 Rue de Rome', addressB: '12B Rue de Rome', scorePct: 94, quartier: 'Balbala' },
        { id: 'd2', kind: 'textual', addressA: 'Avenue 13 Juin', addressB: 'Av. 13-Juin', scorePct: 88, quartier: 'Héron' },
        { id: 'd3', kind: 'spatial', addressA: 'Bloc ILOTS_Q7', addressB: 'Bloc ILOTS-Q7', scorePct: 99, quartier: 'Q7' },
      ],
    };
  }

  override load(): Observable<DataQualityData> {
    return of(this.data()).pipe(delay(400));
  }

  override toggleRule(id: string, enabled: boolean): Observable<QualityRuleRow> {
    const rule = this.rules.find((r) => r.id === id);
    if (!rule) return throwError(() => ({ code: 'not_found', message: 'common.error' }));
    const updated = { ...rule, enabled };
    this.rules = this.rules.map((r) => (r.id === id ? updated : r));
    return of(updated).pipe(delay(200));
  }

  override runScan(): Observable<void> {
    return of(void 0).pipe(delay(600));
  }
}
