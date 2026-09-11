import { TIME_CONFIG } from '../config/timeConfig';

export type TimeSlot = {
  time: string;
  displayTime: string;
  isHour: boolean;
};

export function generateTimeSlots(startTime: string): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const startHour = parseInt(startTime.split(':')[0], 10);
  const startMinute = parseInt(startTime.split(':')[1], 10);

  for (let i = 0; i < TIME_CONFIG.TIME_SLOTS; i++) {
    const totalMinutes = startMinute + i * TIME_CONFIG.MINUTES_PER_SLOT;
    const hour = (startHour + Math.floor(totalMinutes / 60)) % 24;
    const minute = totalMinutes % 60;
    const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

    slots.push({
      time: timeString,
      displayTime: i % TIME_CONFIG.HOUR_MARKER_INTERVAL === 0 ? timeString : '',
      isHour: i % TIME_CONFIG.HOUR_MARKER_INTERVAL === 0,
    });
  }

  return slots;
}
