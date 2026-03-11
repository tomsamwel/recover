import { useEffect, useState } from "react";
import { createMinuteTicker } from "./minuteTicker";

export function useNowMinute(): Date {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => createMinuteTicker(() => setNow(new Date())), []);

  return now;
}
