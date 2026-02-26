export type SnapshotPayload = {
  t: string;
  psi_liq: number | null;
  psi_gas: number | null;
  drive_gain_gas: number | null;
  drive_gain_liquido: number | null;
  temp_liquido: number | null;
  temp_gas: number | null;
  posicion_valvula: number | null;
  densidad: number | null;
  totalgas: number | null;
  totalliq: number | null;
  api: number | null;
  vliq: number | null;
  vgas: number | null;
  delta_p: number | null;
};

export type SeriesPoint = {
  t: string;
  [key: string]: number | string | null;
};

export type TableRow = {
  time: string;
  [key: string]: number | string | null;
};


