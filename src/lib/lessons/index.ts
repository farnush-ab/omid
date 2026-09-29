// Public API of the lesson (record & replay) module. Framework- and chart-agnostic: it only knows
// timelines of state slices; the app layer defines which chart state the slices hold.
export * from './types';
export { TimelineIndex, KEYFRAME_INTERVAL_MS } from './timeline-index';
export {
  TimelineRecorder,
  type RecorderClock,
  type TimelineRecorderOptions,
} from './timeline-recorder';
export { RecordingClock, type RecordingClockState } from './lesson-clock';
export { DatasetCollector, datasetKey, candlesToDataset, datasetToCandles } from './dataset';
export { CapturingProvider, type BarsSink } from './capturing-provider';
export { LessonDataProvider } from './lesson-data-provider';
export {
  encodeTimeline,
  decodeTimeline,
  parseTimeline,
  lessonTimelineSchema,
  LessonFormatError,
  roundSig,
} from './codec';
export { fixWebmDuration, readWebmDuration } from './webm-duration';
export { lerpRecord } from './interpolate';
export {
  StorageLessonRepository,
  type LessonRepository,
  type LessonMeta,
  type Lesson,
  type Draft,
  type DraftHeader,
} from './repository';
