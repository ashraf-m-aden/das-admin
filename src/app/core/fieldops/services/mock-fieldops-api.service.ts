import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { FieldOpsApiPort } from './fieldops-api.port';
import { FieldOpsData } from '../models/fieldops.models';
import { FieldTeam, Task, TaskStatus } from '../../models/das.models';

@Injectable({ providedIn: 'root' })
export class MockFieldOpsApiService extends FieldOpsApiPort {
  private teams: FieldTeam[] = [
    { id: 't1', name: 'Team Alpha', supervisorId: 's1', supervisorName: 'Ahmed Hassan', memberCount: 12, currentZoneId: 'z1', currentZoneName: 'Zone 01', progressPercent: 76, status: 'active', deviceOnline: true },
    { id: 't2', name: 'Team Bravo', supervisorId: 's2', supervisorName: 'Fatouma Ali', memberCount: 10, currentZoneId: 'z2', currentZoneName: 'Zone 02', progressPercent: 58, status: 'active', deviceOnline: true },
    { id: 't3', name: 'Team Charlie', supervisorId: 's3', supervisorName: 'Youssouf Mohamed', memberCount: 8, currentZoneId: 'z3', currentZoneName: 'Zone 03', progressPercent: 81, status: 'en_route', deviceOnline: true },
    { id: 't4', name: 'Team Delta', supervisorId: 's4', supervisorName: 'Halima Ismail', memberCount: 9, currentZoneId: 'z4', currentZoneName: 'Zone 04', progressPercent: 40, status: 'idle', deviceOnline: false },
    { id: 't5', name: 'Team Echo', supervisorId: 's5', supervisorName: 'Abdillahi Omar', memberCount: 7, currentZoneId: 'z5', currentZoneName: 'Zone 05', progressPercent: 22, status: 'offline', deviceOnline: true },
    { id: 't6', name: 'Team Foxtrot', supervisorId: 's6', supervisorName: 'Moussa Ibrahim', memberCount: 11, currentZoneId: 'z1', currentZoneName: 'Zone 01', progressPercent: 63, status: 'active', deviceOnline: true },
  ];

  private task(id: string, title: string, zone: string, addr: number, team: string | null, status: TaskStatus, priority: 'low' | 'normal' | 'high', progress: number): Task {
    return {
      id, blockId: null, redoRequestId: null, type: 'survey', title, zoneName: zone, addressCount: addr,
      assignedTeamId: team ? 'tX' : null, assignedTeamName: team, createdBy: 'admin', status, priority, progressPercent: progress,
      deadline: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
  }

  override load(): Observable<FieldOpsData> {
    const data: FieldOpsData = {
      kpis: { activeTeams: 24, tasksAssignedToday: 156, completedSurveys: 98, completedPct: 62.8, pendingVerifications: 42, offlineDevices: 3, escalations: 7 },
      teams: this.teams,
      schedule: [
        { id: 's1', time: '07:30', teamName: 'Team Alpha', titleKey: 'fieldops.sched.briefing', locationKey: 'fieldops.sched.hqRoom', done: true },
        { id: 's2', time: '08:00', teamName: 'Team Bravo', titleKey: 'fieldops.sched.deployment', locationKey: 'fieldops.sched.zone2', done: true },
        { id: 's3', time: '10:30', teamName: 'Team Charlie', titleKey: 'fieldops.sched.midSync', locationKey: 'fieldops.sched.zone3', done: false },
        { id: 's4', time: '13:00', teamName: 'Team Delta', titleKey: 'fieldops.sched.routeCheck', locationKey: 'fieldops.sched.zone4', done: false },
        { id: 's5', time: '15:30', teamName: 'Team Echo', titleKey: 'fieldops.sched.endOfDay', locationKey: 'fieldops.sched.hqRoom', done: false },
      ],
      columns: [
        { status: 'new', tasks: [
          this.task('k1', 'Survey — Balbala North', 'Zone 01 · 25 adresses', 25, 'Team Alpha', 'new', 'high', 0),
          this.task('k2', 'POI Collection — Le Plateau', 'Key Institutions', 0, 'Team Bravo', 'new', 'normal', 0),
          this.task('k3', 'Boundary Validation', 'Zone 05 · 18 segments', 18, 'Team Echo', 'new', 'low', 0),
        ]},
        { status: 'in_progress', tasks: [
          this.task('k4', 'Survey — Héron Block 7', 'Zone 02 · 30 adresses', 30, 'Team Bravo', 'in_progress', 'normal', 75),
          this.task('k5', 'Address Verification', 'Zone 03 · 40 adresses', 40, 'Team Charlie', 'in_progress', 'normal', 60),
          this.task('k6', 'Road Name Validation', 'Zone 01 · 12 routes', 12, 'Team Alpha', 'in_progress', 'normal', 45),
        ]},
        { status: 'awaiting_review', tasks: [
          this.task('k7', 'Survey — Coedreh', 'Zone 04 · 28 adresses', 28, 'Team Delta', 'awaiting_review', 'normal', 100),
          this.task('k8', 'POI Verification', 'Zone 02 · 15 POIs', 15, 'Team Bravo', 'awaiting_review', 'normal', 100),
          this.task('k9', 'Boundary Check', 'Zone 03 · 9 segments', 9, 'Team Charlie', 'awaiting_review', 'normal', 100),
        ]},
        { status: 'completed', tasks: [
          this.task('k10', 'Survey — Ambouli', 'Zone 05 · 32 adresses', 32, 'Team Echo', 'completed', 'normal', 100),
          this.task('k11', 'Address Verification', 'Zone 01 · 38 adresses', 38, 'Team Alpha', 'completed', 'normal', 100),
          this.task('k12', 'POI Collection — Le Plateau', '20 POIs', 20, 'Team Bravo', 'completed', 'normal', 100),
        ]},
      ],
      review: {
        taskId: 'VER-25-05-00598', submittedBy: 'Team Bravo', submittedAt: new Date().toISOString(),
        latitude: 11.6004, longitude: 43.1486, locationLabel: 'Le Plateau, Djibouti',
        geoConfidence: 92, photoCount: 4,
      },
      teamLocations: [
        { id: 't1', name: 'Team Alpha', status: 'active', location: { type: 'Point', coordinates: [43.140, 11.596] } },
        { id: 't2', name: 'Team Bravo', status: 'active', location: { type: 'Point', coordinates: [43.150, 11.590] } },
        { id: 't3', name: 'Team Charlie', status: 'en_route', location: { type: 'Point', coordinates: [43.132, 11.602] } },
        { id: 't4', name: 'Team Delta', status: 'idle', location: { type: 'Point', coordinates: [43.158, 11.585] } },
        { id: 't5', name: 'Team Echo', status: 'offline', location: { type: 'Point', coordinates: [43.145, 11.610] } },
        { id: 't6', name: 'Team Foxtrot', status: 'active', location: { type: 'Point', coordinates: [43.137, 11.588] } },
      ],
      zones: [
        { id: 'z1', name: 'Zone 01', geom: { type: 'MultiPolygon', coordinates: [[[[43.128, 11.583], [43.150, 11.583], [43.150, 11.600], [43.128, 11.600], [43.128, 11.583]]]] } },
        { id: 'z2', name: 'Zone 02', geom: { type: 'MultiPolygon', coordinates: [[[[43.150, 11.588], [43.168, 11.588], [43.168, 11.606], [43.150, 11.606], [43.150, 11.588]]]] } },
      ],
    };
    return of(data).pipe(delay(420));
  }
}
