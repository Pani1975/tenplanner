// Pista de la animación de clases: medidas, fondo y fichas (alumno, monitor,
// pelota). Es la única pista que se dibuja en la animación, tanto en las
// escenas genéricas como en los esquemas de cada ejercicio, para que todas
// las actividades se vean con el mismo diseño (pista azul alargada).

import {
  COURT,
  H,
  MID_Y,
  NET_X,
  SERVICE_LEFT_X,
  SERVICE_RIGHT,
  SINGLES_BOTTOM,
  SINGLES_TOP,
  W,
} from "@/lib/classes/court-geometry";

export {
  COURT,
  H,
  MID_Y,
  NET_X,
  SERVICE_LEFT_X,
  SERVICE_RIGHT,
  SINGLES_BOTTOM,
  SINGLES_TOP,
  W,
};

export const STUDENT_R = 8;
export const COACH_R = 9.5;
export const BALL_R = 4.5;
export const COLORS = {
  surround: "#123456",
  floor: "#1D5A96",
  student: "#F4F4F1",
  coach: "#D6FF38",
  rival: "#F97316",
  ink: "#050505",
  cone: "#F97316",
  ring: "#FACC15",
} as const;

/** Fondo de pista: suelo, líneas y red. */
export function CourtBase({
  dim = false,
  alleys = false,
}: {
  dim?: boolean;
  alleys?: boolean;
}) {
  return (
    <g opacity={dim ? 0.45 : 1} style={{ transition: "opacity 400ms" }}>
      <rect
        x={COURT.x - 18}
        y={COURT.y - 16}
        width={COURT.w + 36}
        height={COURT.h + 32}
        rx={6}
        fill={COLORS.surround}
      />
      <rect
        x={COURT.x}
        y={COURT.y}
        width={COURT.w}
        height={COURT.h}
        fill={COLORS.floor}
        stroke="#fff"
        strokeOpacity={0.9}
        strokeWidth={2}
      />
      {[0.22, 0.78].map((f) => (
        <line
          key={f}
          x1={COURT.x + COURT.w * f}
          x2={COURT.x + COURT.w * f}
          y1={SINGLES_TOP}
          y2={SINGLES_BOTTOM}
          stroke="#fff"
          strokeOpacity={0.6}
          strokeWidth={1.5}
        />
      ))}
      <line
        x1={SERVICE_LEFT_X}
        x2={SERVICE_RIGHT}
        y1={MID_Y}
        y2={MID_Y}
        stroke="#fff"
        strokeOpacity={0.6}
        strokeWidth={1.5}
      />
      {[SINGLES_TOP, SINGLES_BOTTOM].map((y) => (
        <line
          key={y}
          x1={COURT.x}
          x2={COURT.x + COURT.w}
          y1={y}
          y2={y}
          stroke="#fff"
          strokeOpacity={0.6}
          strokeWidth={1.5}
        />
      ))}
      {alleys &&
        [COURT.y, SINGLES_BOTTOM].map((y) => (
          <rect
            key={`a${y}`}
            x={COURT.x}
            y={y}
            width={COURT.w}
            height={SINGLES_TOP - COURT.y}
            fill="#D6FF38"
            opacity={0.16}
          />
        ))}
      {/* Red */}
      <line
        x1={NET_X}
        x2={NET_X}
        y1={COURT.y - 8}
        y2={COURT.y + COURT.h + 8}
        stroke="#F4F4F1"
        strokeWidth={3}
        strokeDasharray="2 2"
      />
      <circle cx={NET_X} cy={COURT.y - 8} r={3} fill="#F4F4F1" />
      <circle cx={NET_X} cy={COURT.y + COURT.h + 8} r={3} fill="#F4F4F1" />
    </g>
  );
}

/** Alumno (o rival): círculo claro con número o letra. */
export function StudentMarker({
  x,
  y,
  label,
  rival = false,
}: {
  x: number;
  y: number;
  label?: string;
  rival?: boolean;
}) {
  return (
    <g>
      <circle
        cx={x}
        cy={y}
        r={STUDENT_R}
        fill={rival ? COLORS.rival : COLORS.student}
        stroke={COLORS.ink}
        strokeWidth={1.5}
      />
      {label && (
        <text
          x={x}
          y={y + 3}
          textAnchor="middle"
          fontSize={9}
          fontWeight={700}
          fill={COLORS.ink}
        >
          {label}
        </text>
      )}
    </g>
  );
}

/** Monitor: círculo lima con la "M". */
export function CoachMarker({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <circle
        cx={x}
        cy={y}
        r={COACH_R}
        fill={COLORS.coach}
        stroke={COLORS.ink}
        strokeWidth={1.5}
      />
      <text
        x={x}
        y={y + 3.5}
        textAnchor="middle"
        fontSize={9}
        fontWeight={800}
        fill={COLORS.ink}
      >
        M
      </text>
    </g>
  );
}

export function ConeMarker({ x, y }: { x: number; y: number }) {
  return (
    <path
      d={`M ${x} ${y - 7} L ${x + 6} ${y + 5} L ${x - 6} ${y + 5} Z`}
      fill={COLORS.cone}
      stroke={COLORS.ink}
      strokeWidth={1}
    />
  );
}

export function BallMarker({
  x,
  y,
  color,
}: {
  x: number;
  y: number;
  color: string;
}) {
  return (
    <circle
      cx={x}
      cy={y}
      r={BALL_R}
      fill={color}
      stroke="#fff"
      strokeWidth={1}
    />
  );
}

/** Franja inferior con el color del bloque actual. */
export function BlockStripe({ color }: { color: string }) {
  return (
    <rect
      x={0}
      y={H - 4}
      width={W}
      height={4}
      fill={color}
      style={{ transition: "fill 300ms" }}
    />
  );
}
