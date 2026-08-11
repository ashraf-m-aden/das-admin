import { UUID, ISODateTime, FieldTeam, Task, TaskStatus, TaskPriority, FieldTeamStatus, GeoJSONPoint, GeoJSONMultiPolygon } from '../../models/das.models';

export interface FieldOpsKpis {
  activeTeams: number;
  tasksAssignedToday: number;
  completedSurveys: number;
  completedPct: number;
  pendingVerifications: number;
  offlineDevices: number;
  escalations: number;
}

export interface KanbanColumn {
  status: TaskStatus;
  tasks: Task[];
}

export interface VerificationReview {
  taskId: string;
  submittedBy: string;
  submittedAt: ISODateTime;
  latitude: number;
  longitude: number;
  locationLabel: string;
  geoConfidence: number;
  photoCount: number;
}
export interface ScheduleEntry {
  id: string;
  time: string;          // "07:30"
  teamName: string;
  titleKey: string;      // dataquality-style i18n key
  locationKey: string;
  done: boolean;
}
export interface FieldOpsData {
  kpis: FieldOpsKpis;
  teams: FieldTeam[];
  columns: KanbanColumn[];
  review: VerificationReview | null;
  teamLocations: TeamLocation[];
  zones: ZoneBoundary[];
  schedule: ScheduleEntry[];
}

export type { TaskPriority };

export interface TeamLocation { id: string; name: string; status: FieldTeamStatus; location: GeoJSONPoint; }
export interface ZoneBoundary { id: string; name: string; geom: GeoJSONMultiPolygon; }
