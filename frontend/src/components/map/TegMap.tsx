import React from "react";
import type { GameBoard, Color } from "../../types/game";
import type { CombatResultData } from "../../types/game";
import { COLOR_CONFIG, CONTINENT_COLORS } from "../../types/game";
import { Globe, Type, Volume2, VolumeX } from "lucide-react";
import { soundEngine } from "../../services/audio";
import { EVENT_MS, type BoardEvents } from "../game/useBoardEvents";

interface TegMapProps {
  board?: GameBoard;
  selectedFromId: number | null;
  selectedToId: number | null;
  onSelectCountry: (id: number) => void;
  myColor?: Color;
  // Continente a resaltar (p. ej. al pasar el mouse por el panel de continentes)
  highlightContinent?: string | null;
  // Combate en pantalla: se dibuja una flecha del atacante al defensor
  combat?: CombatResultData | null;
  // Lo que acaba de pasar en cada país (cambios de ejércitos y de dueño)
  events?: BoardEvents;
}

interface CountryMeta {
  id: number;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  // Centro de la ficha de tropas (ShapeLeft/ShapeTop del ctlPais en VB)
  fx: number;
  fy: number;
  // Punto interior para escribir el nombre (calculado sobre la silueta, lejos de la ficha)
  lx: number;
  ly: number;
  continent: string;
  borders: number[];
}

const COUNTRY_METAS: CountryMeta[] = [
  {
    id: 1,
    name: "Argentina",
    x: 185.0,
    y: 278.0,
    w: 39.0,
    h: 90.0,
    fx: 200.2,
    fy: 316.5,
    lx: 198.0,
    ly: 305.5,
    continent: "América del Sur",
    borders: [2, 3, 4, 6],
  },
  {
    id: 2,
    name: "Brasil",
    x: 185.0,
    y: 218.0,
    w: 86.0,
    h: 65.0,
    fx: 228.2,
    fy: 250.5,
    lx: 215.0,
    ly: 242.5,
    continent: "América del Sur",
    borders: [1, 3, 5, 6, 41],
  },
  {
    id: 3,
    name: "Uruguay",
    x: 206.0,
    y: 264.0,
    w: 35.0,
    h: 48.0,
    fx: 224.5,
    fy: 292.5,
    lx: 224.0,
    ly: 300.5,
    continent: "América del Sur",
    borders: [1, 2],
  },
  {
    id: 4,
    name: "Chile",
    x: 169.0,
    y: 280.0,
    w: 20.0,
    h: 80.0,
    fx: 179.2,
    fy: 315.2,
    lx: 177.5,
    ly: 293.0,
    continent: "América del Sur",
    borders: [1, 6, 50],
  },
  {
    id: 5,
    name: "Colombia",
    x: 154.0,
    y: 209.0,
    w: 60.0,
    h: 48.0,
    fx: 177.5,
    fy: 233.2,
    lx: 181.5,
    ly: 225.0,
    continent: "América del Sur",
    borders: [2, 6, 7],
  },
  {
    id: 6,
    name: "Perú",
    x: 155.0,
    y: 247.0,
    w: 45.0,
    h: 41.0,
    fx: 177.5,
    fy: 267.5,
    lx: 169.5,
    ly: 275.5,
    continent: "América del Sur",
    borders: [1, 2, 4, 5],
  },
  {
    id: 7,
    name: "México",
    x: 104.0,
    y: 164.0,
    w: 63.0,
    h: 57.0,
    fx: 139.2,
    fy: 192.5,
    lx: 134.5,
    ly: 184.0,
    continent: "América del Norte",
    borders: [5, 8],
  },
  {
    id: 8,
    name: "California",
    x: 54.0,
    y: 149.0,
    w: 117.0,
    h: 64.0,
    fx: 103.2,
    fy: 170.2,
    lx: 90.0,
    ly: 178.5,
    continent: "América del Norte",
    borders: [7, 9, 10],
  },
  {
    id: 9,
    name: "Nueva York",
    x: 100.0,
    y: 92.0,
    w: 100.0,
    h: 80.0,
    fx: 145.2,
    fy: 137.2,
    lx: 125.5,
    ly: 124.0,
    continent: "América del Norte",
    borders: [8, 10, 11, 15, 16],
  },
  {
    id: 10,
    name: "Oregón",
    x: 10.0,
    y: 107.0,
    w: 126.0,
    h: 81.0,
    fx: 73.0,
    fy: 145.5,
    lx: 54.0,
    ly: 153.5,
    continent: "América del Norte",
    borders: [8, 9, 13, 14, 15],
  },
  {
    id: 11,
    name: "Terranova",
    x: 127.0,
    y: 83.0,
    w: 76.0,
    h: 67.0,
    fx: 165.0,
    fy: 116.5,
    lx: 184.5,
    ly: 128.0,
    continent: "América del Norte",
    borders: [9, 12, 15],
  },
  {
    id: 12,
    name: "Labrador",
    x: 159.0,
    y: 56.0,
    w: 53.0,
    h: 68.0,
    fx: 185.5,
    fy: 90.2,
    lx: 182.5,
    ly: 82.0,
    continent: "América del Norte",
    borders: [11, 16],
  },
  {
    id: 13,
    name: "Alaska",
    x: 7.0,
    y: 67.0,
    w: 58.0,
    h: 75.0,
    fx: 36.0,
    fy: 104.5,
    lx: 32.0,
    ly: 112.5,
    continent: "América del Norte",
    borders: [10, 14, 29],
  },
  {
    id: 14,
    name: "Yukón",
    x: 44.0,
    y: 33.0,
    w: 56.0,
    h: 92.0,
    fx: 72.2,
    fy: 85.2,
    lx: 78.0,
    ly: 93.5,
    continent: "América del Norte",
    borders: [10, 13, 15],
  },
  {
    id: 15,
    name: "Canadá",
    x: 68.0,
    y: 1.0,
    w: 95.0,
    h: 118.0,
    fx: 113.5,
    fy: 53.2,
    lx: 115.0,
    ly: 42.0,
    continent: "América del Norte",
    borders: [9, 10, 11, 14],
  },
  {
    id: 16,
    name: "Groenlandia",
    x: 193.0,
    y: 5.0,
    w: 83.0,
    h: 89.0,
    fx: 241.5,
    fy: 44.2,
    lx: 242.5,
    ly: 36.0,
    continent: "América del Norte",
    borders: [9, 12, 17],
  },
  {
    id: 17,
    name: "Islandia",
    x: 288.0,
    y: 56.0,
    w: 33.0,
    h: 26.0,
    fx: 303.2,
    fy: 67.5,
    lx: 304.5,
    ly: 59.5,
    continent: "Europa",
    borders: [16, 18, 19],
  },
  {
    id: 18,
    name: "Gran Bretaña",
    x: 290.0,
    y: 103.0,
    w: 31.0,
    h: 43.0,
    fx: 307.2,
    fy: 132.2,
    lx: 306.0,
    ly: 140.5,
    continent: "Europa",
    borders: [17, 22, 25],
  },
  {
    id: 19,
    name: "Suecia",
    x: 337.0,
    y: 30.0,
    w: 49.0,
    h: 54.0,
    fx: 362.2,
    fy: 57.0,
    lx: 366.0,
    ly: 65.0,
    continent: "Europa",
    borders: [17, 20],
  },
  {
    id: 20,
    name: "Rusia",
    x: 378.0,
    y: 48.0,
    w: 81.0,
    h: 99.0,
    fx: 410.2,
    fy: 100.2,
    lx: 415.5,
    ly: 108.5,
    continent: "Europa",
    borders: [19, 21, 26, 31, 36],
  },
  {
    id: 21,
    name: "Polonia",
    x: 371.0,
    y: 116.0,
    w: 60.0,
    h: 55.0,
    fx: 401.0,
    fy: 143.5,
    lx: 411.0,
    ly: 151.5,
    continent: "Europa",
    borders: [20, 22, 36, 42],
  },
  {
    id: 22,
    name: "Alemania",
    x: 358.0,
    y: 122.0,
    w: 52.0,
    h: 52.0,
    fx: 377.6,
    fy: 148.2,
    lx: 379.5,
    ly: 156.5,
    continent: "Europa",
    borders: [18, 21, 23, 24],
  },
  {
    id: 23,
    name: "Francia",
    x: 333.0,
    y: 136.0,
    w: 38.0,
    h: 55.0,
    fx: 352.2,
    fy: 163.5,
    lx: 350.0,
    ly: 155.5,
    continent: "Europa",
    borders: [22, 24, 25],
  },
  {
    id: 24,
    name: "Italia",
    x: 353.0,
    y: 170.0,
    w: 48.0,
    h: 45.0,
    fx: 374.5,
    fy: 182.6,
    lx: 383.5,
    ly: 191.0,
    continent: "Europa",
    borders: [22, 23],
  },
  {
    id: 25,
    name: "España",
    x: 291.0,
    y: 158.0,
    w: 48.0,
    h: 49.0,
    fx: 313.2,
    fy: 181.5,
    lx: 306.0,
    ly: 189.5,
    continent: "Europa",
    borders: [18, 23, 41],
  },
  {
    id: 26,
    name: "Aral",
    x: 412.0,
    y: 35.0,
    w: 37.0,
    h: 45.0,
    fx: 430.5,
    fy: 57.5,
    lx: 432.5,
    ly: 49.5,
    continent: "Asia",
    borders: [20, 27, 30, 31, 32],
  },
  {
    id: 27,
    name: "Tartaria",
    x: 424.0,
    y: 16.0,
    w: 50.0,
    h: 46.0,
    fx: 449.2,
    fy: 33.2,
    lx: 453.0,
    ly: 41.5,
    continent: "Asia",
    borders: [26, 28, 30],
  },
  {
    id: 28,
    name: "Taimir",
    x: 456.0,
    y: 17.0,
    w: 41.0,
    h: 34.0,
    fx: 476.5,
    fy: 30.5,
    lx: 476.5,
    ly: 22.0,
    continent: "Asia",
    borders: [27, 30],
  },
  {
    id: 29,
    name: "Kamchatka",
    x: 506.0,
    y: 5.0,
    w: 41.0,
    h: 40.0,
    fx: 526.5,
    fy: 20.2,
    lx: 518.0,
    ly: 28.5,
    continent: "Asia",
    borders: [13, 30, 34, 35],
  },
  {
    id: 30,
    name: "Siberia",
    x: 440.0,
    y: 15.0,
    w: 79.0,
    h: 58.0,
    fx: 498.5,
    fy: 47.2,
    lx: 502.0,
    ly: 39.0,
    continent: "Asia",
    borders: [26, 27, 28, 29, 32, 34],
  },
  {
    id: 31,
    name: "Irán",
    x: 424.0,
    y: 73.0,
    w: 80.0,
    h: 92.0,
    fx: 453.2,
    fy: 121.5,
    lx: 463.0,
    ly: 133.0,
    continent: "Asia",
    borders: [20, 26, 32, 33, 34, 36, 40],
  },
  {
    id: 32,
    name: "Mongolia",
    x: 439.0,
    y: 62.0,
    w: 73.0,
    h: 40.0,
    fx: 487.5,
    fy: 77.2,
    lx: 498.5,
    ly: 85.5,
    continent: "Asia",
    borders: [26, 30, 31, 33, 34],
  },
  {
    id: 33,
    name: "Gobi",
    x: 448.0,
    y: 84.0,
    w: 55.0,
    h: 55.0,
    fx: 478.2,
    fy: 109.2,
    lx: 484.0,
    ly: 117.5,
    continent: "Asia",
    borders: [31, 32, 34],
  },
  {
    id: 34,
    name: "China",
    x: 490.0,
    y: 31.0,
    w: 80.0,
    h: 125.0,
    fx: 530.0,
    fy: 97.2,
    lx: 531.0,
    ly: 119.0,
    continent: "Asia",
    borders: [29, 30, 31, 32, 33, 35, 37, 40],
  },
  {
    id: 35,
    name: "Japón",
    x: 557.0,
    y: 22.0,
    w: 22.0,
    h: 47.0,
    fx: 568.2,
    fy: 45.5,
    lx: 569.5,
    ly: 53.5,
    continent: "Asia",
    borders: [29, 34],
  },
  {
    id: 36,
    name: "Turquía",
    x: 416.0,
    y: 142.0,
    w: 76.0,
    h: 36.0,
    fx: 444.5,
    fy: 155.5,
    lx: 468.0,
    ly: 151.0,
    continent: "Asia",
    borders: [20, 21, 31, 38, 39, 42],
  },
  {
    id: 37,
    name: "Malasia",
    x: 537.0,
    y: 136.0,
    w: 41.0,
    h: 46.0,
    fx: 557.5,
    fy: 159.2,
    lx: 557.5,
    ly: 167.5,
    continent: "Asia",
    borders: [34, 40, 48],
  },
  {
    id: 38,
    name: "Israel",
    x: 430.0,
    y: 164.0,
    w: 33.0,
    h: 25.0,
    fx: 443.5,
    fy: 177.2,
    lx: 438.0,
    ly: 186.0,
    continent: "Asia",
    borders: [36, 39, 42],
  },
  {
    id: 39,
    name: "Arabia",
    x: 453.0,
    y: 167.0,
    w: 32.0,
    h: 26.0,
    fx: 466.5,
    fy: 180.0,
    lx: 464.0,
    ly: 188.0,
    continent: "Asia",
    borders: [36, 38],
  },
  {
    id: 40,
    name: "India",
    x: 491.0,
    y: 143.0,
    w: 52.0,
    h: 62.0,
    fx: 517.0,
    fy: 173.5,
    lx: 517.0,
    ly: 165.5,
    continent: "Asia",
    borders: [31, 34, 37, 47],
  },
  {
    id: 41,
    name: "Sahara",
    x: 299.0,
    y: 244.0,
    w: 76.0,
    h: 70.0,
    fx: 334.2,
    fy: 276.2,
    lx: 335.5,
    ly: 284.5,
    continent: "África",
    borders: [2, 25, 42, 43, 44],
  },
  {
    id: 42,
    name: "Egipto",
    x: 358.0,
    y: 239.0,
    w: 106.0,
    h: 54.0,
    fx: 411.2,
    fy: 261.2,
    lx: 406.0,
    ly: 253.0,
    continent: "África",
    borders: [21, 36, 38, 41, 43, 46],
  },
  {
    id: 43,
    name: "Etiopía",
    x: 362.0,
    y: 268.0,
    w: 79.0,
    h: 41.0,
    fx: 401.5,
    fy: 288.5,
    lx: 413.0,
    ly: 296.5,
    continent: "África",
    borders: [41, 42, 44, 45],
  },
  {
    id: 44,
    name: "Zaire",
    x: 340.0,
    y: 285.0,
    w: 62.0,
    h: 43.0,
    fx: 377.2,
    fy: 303.5,
    lx: 384.5,
    ly: 311.5,
    continent: "África",
    borders: [41, 43, 45, 46],
  },
  {
    id: 45,
    name: "Sudáfrica",
    x: 392.0,
    y: 301.0,
    w: 42.0,
    h: 50.0,
    fx: 413.2,
    fy: 323.2,
    lx: 417.0,
    ly: 331.5,
    continent: "África",
    borders: [43, 44],
  },
  {
    id: 46,
    name: "Madagascar",
    x: 441.0,
    y: 299.0,
    w: 28.0,
    h: 57.0,
    fx: 455.0,
    fy: 327.5,
    lx: 455.5,
    ly: 319.5,
    continent: "África",
    borders: [42, 44],
  },
  {
    id: 47,
    name: "Sumatra",
    x: 478.0,
    y: 243.0,
    w: 29.0,
    h: 30.0,
    fx: 492.5,
    fy: 258.0,
    lx: 498.0,
    ly: 266.0,
    continent: "Oceanía",
    borders: [40, 50],
  },
  {
    id: 48,
    name: "Borneo",
    x: 527.0,
    y: 220.0,
    w: 22.0,
    h: 37.0,
    fx: 538.0,
    fy: 235.2,
    lx: 537.5,
    ly: 227.0,
    continent: "Oceanía",
    borders: [37, 50],
  },
  {
    id: 49,
    name: "Java",
    x: 566.0,
    y: 224.0,
    w: 22.0,
    h: 39.0,
    fx: 577.0,
    fy: 243.5,
    lx: 579.5,
    ly: 235.5,
    continent: "Oceanía",
    borders: [50],
  },
  {
    id: 50,
    name: "Australia",
    x: 506.0,
    y: 279.0,
    w: 67.0,
    h: 52.0,
    fx: 539.5,
    fy: 305.0,
    lx: 546.0,
    ly: 297.0,
    continent: "Oceanía",
    borders: [4, 47, 48, 49],
  },
];

const posMap = new Map<number, CountryMeta>();
COUNTRY_METAS.forEach((p) => posMap.set(p.id, p));

// Conectores marítimos (lnConector del frmMapa en VB). `a`/`b` son los países
// que une; los cruces que dan la vuelta al mundo (Australia–Chile y
// Kamchatka–Alaska) se dibujan como dos tramos que salen por los bordes.
interface Connector {
  a: number;
  b: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  // Punto de control opcional: si está, el conector es una curva
  cx?: number;
  cy?: number;
}

const CONNECTORS: Connector[] = [
  { a: 2, b: 41, x1: 263, y1: 254, x2: 303, y2: 262 },
  { a: 41, b: 25, x1: 327, y1: 248, x2: 311, y2: 201 },
  { a: 42, b: 21, x1: 412, y1: 240, x2: 414, y2: 167 },
  { a: 42, b: 36, x1: 416, y1: 240, x2: 423, y2: 177 },
  { a: 42, b: 38, x1: 428, y1: 248, x2: 440, y2: 185 },
  { a: 47, b: 50, x1: 501, y1: 271, x2: 510, y2: 290 },
  { a: 48, b: 50, x1: 532, y1: 254, x2: 537, y2: 282 },
  { a: 50, b: 49, x1: 561, y1: 280, x2: 574, y2: 259 },
  { a: 50, b: 4, x1: 567, y1: 307, x2: 593, y2: 307 },
  { a: 50, b: 4, x1: 0, y1: 304, x2: 172, y2: 304 },
  { a: 47, b: 40, x1: 487, y1: 244, x2: 499, y2: 204 },
  { a: 37, b: 48, x1: 560, y1: 178, x2: 539, y2: 222 },
  { a: 17, b: 19, x1: 321, y1: 66, x2: 349, y2: 57 },
  { a: 17, b: 18, x1: 306, y1: 81, x2: 310, y2: 103 },
  { a: 16, b: 17, x1: 270, y1: 45, x2: 297, y2: 60 },
  { a: 18, b: 25, x1: 303, y1: 145, x2: 298, y2: 166 },
  { a: 18, b: 22, x1: 320, y1: 126, x2: 359, y2: 128 },
  { a: 12, b: 16, x1: 200, y1: 78, x2: 230, y2: 61 },
  { a: 9, b: 16, x1: 194, y1: 161, x2: 245, y2: 88 },
  { a: 29, b: 35, x1: 548, y1: 17, x2: 561, y2: 27 },
  { a: 34, b: 35, x1: 547, y1: 75, x2: 564, y2: 62 },
  { a: 29, b: 13, x1: 546, y1: 9, x2: 593, y2: 26 },
  { a: 29, b: 13, x1: 0, y1: 62, x2: 28, y2: 74 },
  // Madagascar: no estaban en el VB; trazados como en el tablero clásico
  { a: 42, b: 46, x1: 456, y1: 275, x2: 456, y2: 300 },
  { a: 44, b: 46, x1: 386, y1: 328, x2: 450, y2: 353, cx: 412, cy: 380 },
];

// Los tramos que tocan el borde del tablero (x=0 o x=593) se prolongan hasta
// el borde del área visible, que puede ser más ancha que el mapa.
const extendToEdge = (k: Connector): [number, number, number, number] => {
  const far = (px: number, py: number, qx: number, qy: number) => {
    const len = Math.hypot(px - qx, py - qy);
    return [px + ((px - qx) / len) * 3000, py + ((py - qy) / len) * 3000];
  };
  if (k.x1 === 0 || k.x1 === 593) {
    const [x, y] = far(k.x1, k.y1, k.x2, k.y2);
    return [x, y, k.x2, k.y2];
  }
  if (k.x2 === 0 || k.x2 === 593) {
    const [x, y] = far(k.x2, k.y2, k.x1, k.y1);
    return [k.x1, k.y1, x, y];
  }
  return [k.x1, k.y1, k.x2, k.y2];
};

// Ubica el nombre del país para que no se corte en los bordes del mapa.
const tooltipPosition = (c: CountryMeta) => {
  const cx = c.x + c.w / 2;
  const vertical = c.y < 30 ? "top-full mt-1" : "bottom-full mb-1";
  const horizontal =
    cx < 50 ? "left-0" : cx > 543 ? "right-0" : "left-1/2 -translate-x-1/2";
  return `${vertical} ${horizontal}`;
};

// Océano: azul pizarra oscuro con viñeta y una grilla tenue de carta militar.
const OCEAN_STYLE: React.CSSProperties = {
  backgroundColor: "#0e1620",
  backgroundImage: [
    "radial-gradient(ellipse at center, rgba(51,65,85,0.35) 0%, rgba(2,6,23,0.6) 100%)",
    "linear-gradient(rgba(148,163,184,0.06) 1px, transparent 1px)",
    "linear-gradient(90deg, rgba(148,163,184,0.06) 1px, transparent 1px)",
  ].join(", "),
  backgroundSize: "100% 100%, 48px 48px, 48px 48px",
  backgroundPosition: "center",
};

// Máscaras de las siluetas en memoria, para saber qué país está bajo el cursor.
// El navegador resuelve los clicks por el rectángulo de cada elemento (la máscara
// CSS no cuenta), y los rectángulos de países vecinos se superponen.
interface HitMask {
  width: number;
  height: number;
  alpha: Uint8ClampedArray;
}

const hitMasks = new Map<number, HitMask>();
let hitMasksRequested = false;

const loadHitMasks = () => {
  if (hitMasksRequested) return;
  hitMasksRequested = true;
  COUNTRY_METAS.forEach((c) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const alpha = new Uint8ClampedArray(canvas.width * canvas.height);
      for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * 4 + 3];
      hitMasks.set(c.id, { width: canvas.width, height: canvas.height, alpha });
    };
    img.src = `/map/countries/${c.id}.png`;
  });
};

// País cuya silueta cubre exactamente el punto (mx, my), en coordenadas del
// tablero 593x380. Se recorre de arriba hacia abajo en el orden de dibujo; sin
// máscara cargada se usa el rectángulo.
const countryUnder = (mx: number, my: number): number | null => {
  for (let i = COUNTRY_METAS.length - 1; i >= 0; i--) {
    const c = COUNTRY_METAS[i];
    if (mx < c.x || my < c.y || mx >= c.x + c.w || my >= c.y + c.h) continue;
    const mask = hitMasks.get(c.id);
    if (!mask) return c.id;
    const u = Math.floor(((mx - c.x) / c.w) * mask.width);
    const v = Math.floor(((my - c.y) / c.h) * mask.height);
    if (mask.alpha[v * mask.width + u] >= 128) return c.id;
  }
  return null;
};

const BADGE_RADIUS = 4.5; // radio de la ficha de tropas, en px del tablero
const COAST_TOLERANCE = 4; // cuánto mar alrededor de la costa sigue contando

// País a seleccionar en (mx, my): primero la ficha de tropas (es el blanco más
// claro en países chicos), después la silueta y, si se cae al mar cerca de la
// costa, el país más próximo.
const countryAt = (mx: number, my: number): number | null => {
  let badge: number | null = null;
  let badgeDist = BADGE_RADIUS;
  for (const c of COUNTRY_METAS) {
    const d = Math.hypot(mx - c.fx, my - c.fy);
    if (d <= badgeDist) {
      badge = c.id;
      badgeDist = d;
    }
  }
  if (badge !== null) return badge;

  const exact = countryUnder(mx, my);
  if (exact !== null) return exact;

  for (let r = 1; r <= COAST_TOLERANCE; r++) {
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      const id = countryUnder(mx + Math.cos(a) * r, my + Math.sin(a) * r);
      if (id !== null) return id;
    }
  }
  return null;
};

const NO_EVENTS: BoardEvents = {};

const joins = (c: Connector, p: number | null, q: number | null) =>
  (c.a === p && c.b === q) || (c.a === q && c.b === p);

export const TegMap: React.FC<TegMapProps> = ({
  board,
  selectedFromId,
  selectedToId,
  onSelectCountry,
  myColor,
  highlightContinent = null,
  combat = null,
  events = NO_EVENTS,
}) => {
  const [muted, setMuted] = React.useState(soundEngine.isMuted());
  const [showContinents, setShowContinents] = React.useState(false);
  const [showNames, setShowNames] = React.useState(true);
  const [legendHover, setLegendHover] = React.useState<string | null>(null);
  const highlight = highlightContinent ?? legendHover;
  const [hoveredId, setHoveredId] = React.useState<number | null>(null);

  React.useEffect(loadHitMasks, []);

  const pointToCountry = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return countryAt(
      ((e.clientX - r.left) / r.width) * 593,
      ((e.clientY - r.top) / r.height) * 380,
    );
  };

  return (
    <div
      className="relative w-full h-full flex items-center justify-center overflow-hidden select-none"
      style={{ containerType: "size", ...OCEAN_STYLE }}
    >
      {/* Controles de visualización */}
      <div className="absolute top-3 left-3 z-50 flex flex-col items-start gap-2">
        <div className="flex gap-2">
          <MapToggle
            active={showContinents}
            onClick={() => setShowContinents((v) => !v)}
            icon={<Globe className="w-3.5 h-3.5" />}
            label="Continentes"
          />
          <MapToggle
            active={showNames}
            onClick={() => setShowNames((v) => !v)}
            icon={<Type className="w-3.5 h-3.5" />}
            label="Nombres"
          />
          <MapToggle
            active={!muted}
            onClick={() => {
              soundEngine.setMuted(!muted);
              setMuted(!muted);
            }}
            icon={
              muted ? (
                <VolumeX className="w-3.5 h-3.5" />
              ) : (
                <Volume2 className="w-3.5 h-3.5" />
              )
            }
            label={muted ? "Sin sonido" : "Sonido"}
          />
        </div>
        {showContinents && (
          <div className="bg-slate-950/85 border border-slate-700 rounded-lg px-2.5 py-2 space-y-1 backdrop-blur-sm">
            {Object.entries(CONTINENT_COLORS).map(([name, hex]) => (
              <div
                key={name}
                onMouseEnter={() => setLegendHover(name)}
                onMouseLeave={() => setLegendHover(null)}
                className={`flex items-center gap-2 text-[11px] font-semibold cursor-default transition-opacity ${
                  highlight && highlight !== name ? "opacity-40" : ""
                }`}
              >
                <span
                  className="w-3 h-3 rounded-sm"
                  style={{ backgroundColor: hex }}
                />
                <span className="text-slate-200">{name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 593x380: escala al máximo que entra sin deformarse; el océano llena el resto.
          --u = un pixel del tablero original, para escalar los textos con el mapa. */}
      <div
        className={`relative aspect-[593/380] ${hoveredId !== null ? "cursor-pointer" : ""}`}
        onClick={(e) => {
          const id = pointToCountry(e);
          if (id !== null) onSelectCountry(id);
        }}
        onMouseMove={(e) => {
          const id = pointToCountry(e);
          if (id !== hoveredId) setHoveredId(id);
        }}
        onMouseLeave={() => setHoveredId(null)}
        style={
          {
            width: "min(100cqw, calc(100cqh * 593 / 380))",
            "--u": "calc(min(100cqw, calc(100cqh * 593 / 380)) / 593)",
          } as React.CSSProperties
        }
      >
        {/* SVG Attack Vector Lines Layer */}
        <svg
          viewBox="0 0 593 380"
          preserveAspectRatio="xMidYMid meet"
          overflow="visible"
          className="absolute inset-0 w-full h-full pointer-events-none z-10"
        >
          {/* Conectores marítimos: siempre visibles, resaltados si son el camino de ataque */}
          {CONNECTORS.map((k, i) => {
            const active = joins(k, selectedFromId, selectedToId);
            const [x1, y1, x2, y2] = extendToEdge(k);
            const d =
              k.cx !== undefined && k.cy !== undefined
                ? `M ${x1} ${y1} Q ${k.cx} ${k.cy} ${x2} ${y2}`
                : `M ${x1} ${y1} L ${x2} ${y2}`;
            return (
              <path
                key={`conn-${i}`}
                d={d}
                fill="none"
                stroke={active ? "#f59e0b" : "#94a3b8"}
                strokeOpacity={active ? 1 : 0.55}
                strokeWidth={active ? 3.5 : 1.2}
                strokeDasharray={active ? "5,5" : "2,2"}
                className={active ? "animate-pulse" : undefined}
              />
            );
          })}

          {COUNTRY_METAS.map((c) =>
            c.borders.map((bId) => {
              if (c.id < bId) {
                const target = posMap.get(bId);
                if (!target) return null;

                const isAttackPath =
                  (selectedFromId === c.id && selectedToId === bId) ||
                  (selectedFromId === bId && selectedToId === c.id);

                // Los cruces por mar ya se resaltan con su conector
                if (
                  !isAttackPath ||
                  CONNECTORS.some((k) => joins(k, c.id, bId))
                )
                  return null;

                return (
                  <line
                    key={`line-${c.id}-${bId}`}
                    x1={c.x + c.w / 2}
                    y1={c.y + c.h / 2}
                    x2={target.x + target.w / 2}
                    y2={target.y + target.h / 2}
                    stroke="#f59e0b"
                    strokeWidth="3.5"
                    strokeDasharray="5,5"
                    className="animate-pulse"
                  />
                );
              }
              return null;
            }),
          )}
        </svg>

        {/* 50 Irregular Country GIF Shape Mask Layers */}
        <div className="absolute inset-0 w-full h-full">
          {COUNTRY_METAS.map((c) => {
            const state = board?.countries[c.id];
            const ownerColor = state?.owner;
            const armies = state?.armies || 1;
            const isFrom = selectedFromId === c.id;
            const isTo = selectedToId === c.id;
            const isMine = state?.owner === myColor;
            const dimmed = highlight !== null && c.continent !== highlight;
            const isHovered = hoveredId === c.id;

            const ownerHex = ownerColor
              ? COLOR_CONFIG[ownerColor]?.hex
              : undefined;
            const colorHex = showContinents
              ? CONTINENT_COLORS[c.continent]
              : (ownerHex ?? "#ffffff");

            // Lo que acaba de pasar en el país: brillo y, si cambió de dueño,
            // barrido del color nuevo desde el lado del ataque
            const ev = events[c.id];
            const wipeFrom =
              ev?.conquered && ev.fromColor && !showContinents
                ? COLOR_CONFIG[ev.fromColor]?.hex
                : undefined;
            const origin = ev?.origin ? posMap.get(ev.origin) : undefined;
            const wipeAt = origin
              ? `${((origin.fx - c.x) / c.w) * 100}% ${((origin.fy - c.y) / c.h) * 100}%`
              : "0% 50%";
            const eventGlow = !ev
              ? undefined
              : ev.conquered
                ? `drop-shadow(0 0 1px #fff) drop-shadow(0 0 7px ${COLOR_CONFIG[ev.toColor!]?.hex ?? "#fff"})`
                : ev.delta > 0
                  ? "drop-shadow(0 0 1px #fff) drop-shadow(0 0 5px #34d399)"
                  : "drop-shadow(0 0 1px #fff) drop-shadow(0 0 5px #f87171)";
            const mask: React.CSSProperties = {
              maskImage: `url(/map/countries/${c.id}.png)`,
              WebkitMaskImage: `url(/map/countries/${c.id}.png)`,
              maskSize: "100% 100%",
              WebkitMaskSize: "100% 100%",
              maskRepeat: "no-repeat",
              WebkitMaskRepeat: "no-repeat",
              maskPosition: "center",
              WebkitMaskPosition: "center",
            };

            return (
              <div
                key={c.id}
                className={`absolute pointer-events-none transition-transform duration-150 group ${
                  isFrom || isTo
                    ? "z-40"
                    : isHovered
                      ? "z-30 scale-110"
                      : "z-20"
                }`}
                style={{
                  left: `${(c.x / 593) * 100}%`,
                  top: `${(c.y / 380) * 100}%`,
                  width: `${(c.w / 593) * 100}%`,
                  height: `${(c.h / 380) * 100}%`,
                  opacity: dimmed ? 0.2 : 1,
                  transition: "opacity 150ms, transform 150ms",
                }}
              >
                {/* Contorno: el drop-shadow se aplica sobre la silueta ya enmascarada,
                    así las fronteras se ven aunque ambos países sean del mismo color */}
                <div
                  className="relative w-full h-full"
                  style={{
                    filter: isFrom
                      ? "drop-shadow(0 0 1px #fff) drop-shadow(0 0 6px #f59e0b)"
                      : isTo
                        ? "drop-shadow(0 0 1px #fff) drop-shadow(0 0 6px #ef4444)"
                        : (eventGlow ??
                          "drop-shadow(0 0 0.6px #020617) drop-shadow(0 0 0.6px #020617)"),
                    transition: "filter 400ms",
                  }}
                >
                  {/* Irregular Country Mask Image */}
                  <div
                    key={ev?.key}
                    className={`w-full h-full transition-all duration-200 ${ev ? "map-event-flash" : ""}`}
                    style={{
                      ...mask,
                      backgroundColor: wipeFrom ?? colorHex,
                      opacity:
                        isFrom || isTo || showContinents
                          ? 1.0
                          : ownerColor
                            ? 0.9
                            : 0.4,
                      filter:
                        isFrom || isTo
                          ? "brightness(1.3)"
                          : isMine
                            ? "brightness(1.1)"
                            : undefined,
                      backgroundRepeat: "no-repeat",
                      backgroundSize: "100% 100%",
                      transform: "translateZ(0)",
                    }}
                  />
                  {/* Barrido del color del nuevo dueño */}
                  {wipeFrom && (
                    <div
                      key={`wipe-${ev!.key}`}
                      className="absolute inset-0 map-owner-wipe"
                      style={
                        {
                          ...mask,
                          backgroundColor: colorHex,
                          opacity: 0.9,
                          "--wipe-at": wipeAt,
                        } as React.CSSProperties
                      }
                    />
                  )}
                </div>

                {/* Country Name Tooltip on Hover (solo si los nombres están ocultos) */}
                {!showNames && isHovered && (
                  <div
                    className={`absolute ${tooltipPosition(c)} bg-slate-950 text-white text-[10px] font-bold px-2 py-0.5 rounded-md border border-slate-700 whitespace-nowrap z-50 shadow-xl pointer-events-none`}
                  >
                    {c.name}
                  </div>
                )}

                {/* Army Counter Badge (posición original del VB). En la vista de
                    continentes la ficha toma el color del dueño para no perder esa info. */}
                <div
                  style={{
                    left: `${((c.fx - c.x) / c.w) * 100}%`,
                    top: `${((c.fy - c.y) / c.h) * 100}%`,
                    backgroundColor:
                      showContinents && !isFrom && !isTo ? ownerHex : undefined,
                  }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center font-black text-[10px] text-white shadow-lg pointer-events-none transition-transform ${
                    isFrom
                      ? "bg-amber-500 scale-125 ring-2 ring-amber-300"
                      : isTo
                        ? "bg-rose-600 scale-125 ring-2 ring-rose-400"
                        : "bg-slate-950/90 border border-white/30"
                  }`}
                >
                  {armies}
                </div>
              </div>
            );
          })}
        </div>

        {/* Nombres de los países, como en el tablero */}
        {showNames && (
          <div className="absolute inset-0 pointer-events-none z-30">
            {COUNTRY_METAS.map((c) => (
              <span
                key={c.id}
                className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap font-bold uppercase tracking-wide text-white/85 transition-opacity"
                style={{
                  left: `${(c.lx / 593) * 100}%`,
                  top: `${(c.ly / 380) * 100}%`,
                  fontSize: "calc(var(--u) * 5.2)",
                  textShadow:
                    "0 0 2px #020617, 0 0 3px #020617, 0 1px 1px #020617",
                  opacity:
                    highlight !== null && c.continent !== highlight ? 0.15 : 1,
                }}
              >
                {c.name}
              </span>
            ))}
          </div>
        )}

        {/* Flecha del combate en pantalla */}
        {combat && (
          <svg
            viewBox="0 0 593 380"
            overflow="visible"
            className="absolute inset-0 w-full h-full pointer-events-none z-[35]"
          >
            <AttackArrow combat={combat} />
          </svg>
        )}

        {/* Cambios de ejércitos: ▲ +N / ▼ −N sobre la ficha */}
        <div className="absolute inset-0 pointer-events-none z-40">
          {Object.entries(events).map(([id, ev]) => {
            const c = posMap.get(Number(id));
            if (!c || (ev.delta === 0 && !ev.conquered)) return null;
            const up = ev.delta > 0;
            return (
              <span
                key={ev.key}
                className={`absolute map-delta whitespace-nowrap rounded-md px-[0.35em] py-[0.1em] font-black shadow-lg ${
                  ev.conquered
                    ? "text-white"
                    : up
                      ? "bg-emerald-400 text-slate-950"
                      : "bg-rose-600 text-white"
                }`}
                style={{
                  left: `${(c.fx / 593) * 100}%`,
                  top: `${(c.fy / 380) * 100}%`,
                  fontSize: "calc(var(--u) * 5.5)",
                  backgroundColor: ev.conquered
                    ? COLOR_CONFIG[ev.toColor!]?.hex
                    : undefined,
                  animationDuration: `${EVENT_MS}ms`,
                }}
              >
                {ev.conquered && "⚑ "}
                {ev.delta !== 0 && (up ? `▲ +${ev.delta}` : `▼ −${-ev.delta}`)}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// Flecha del atacante al defensor, de ficha a ficha. En los cruces que dan la
// vuelta al mundo sigue la ruta: sale por un borde y entra por el otro.
const AttackArrow: React.FC<{ combat: CombatResultData }> = ({ combat }) => {
  const from = posMap.get(combat.fromCountryId);
  const to = posMap.get(combat.toCountryId);
  if (!from || !to) return null;
  const color = COLOR_CONFIG[combat.attacker]?.hex ?? "#f59e0b";
  const markerId = `atk-head-${combat.attacker}`;

  const wrap = CONNECTORS.filter(
    (k) =>
      joins(k, combat.fromCountryId, combat.toCountryId) &&
      [k.x1, k.x2].some((x) => x === 0 || x === 593),
  );

  let paths: string[];
  if (wrap.length === 2) {
    // Tramo del lado del atacante y tramo del lado del defensor
    const near = (k: Connector, p: CountryMeta) => {
      const inner = k.x1 === 0 || k.x1 === 593 ? [k.x2, k.y2] : [k.x1, k.y1];
      const edge = k.x1 === 0 || k.x1 === 593 ? [k.x1, k.y1] : [k.x2, k.y2];
      return { inner, edge, d: Math.hypot(inner[0] - p.fx, inner[1] - p.fy) };
    };
    const [a, b] = wrap.map((k) => near(k, from));
    const out = a.d < b.d ? a : b;
    const inn = a.d < b.d ? b : a;
    paths = [
      `M ${from.fx} ${from.fy} L ${out.inner[0]} ${out.inner[1]} L ${out.edge[0]} ${out.edge[1]}`,
      `M ${inn.edge[0]} ${inn.edge[1]} L ${inn.inner[0]} ${inn.inner[1]} L ${to.fx} ${to.fy}`,
    ];
  } else {
    // Curva suave entre las dos fichas, recortada para no tapar los números
    const dx = to.fx - from.fx;
    const dy = to.fy - from.fy;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const sx = from.fx + ux * 6;
    const sy = from.fy + uy * 6;
    const ex = to.fx - ux * 7;
    const ey = to.fy - uy * 7;
    const bend = Math.min(len * 0.18, 24);
    const cx = (sx + ex) / 2 - uy * bend;
    const cy = (sy + ey) / 2 + ux * bend;
    paths = [`M ${sx} ${sy} Q ${cx} ${cy} ${ex} ${ey}`];
  }

  return (
    <g>
      <defs>
        <marker
          id={markerId}
          viewBox="0 0 10 10"
          refX="6"
          refY="5"
          markerWidth="4"
          markerHeight="4"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
        </marker>
      </defs>
      {paths.map((d, i) => (
        <g key={i}>
          <path
            d={d}
            fill="none"
            stroke="#020617"
            strokeOpacity={0.7}
            strokeWidth={4.5}
            strokeLinecap="round"
          />
          <path
            d={d}
            fill="none"
            stroke={color}
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeDasharray="6 4"
            className="map-attack-dash"
            markerEnd={i === paths.length - 1 ? `url(#${markerId})` : undefined}
          />
        </g>
      ))}
    </g>
  );
};

const MapToggle: React.FC<{
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}> = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    aria-pressed={active}
    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold backdrop-blur-sm transition ${
      active
        ? "bg-amber-500/90 border-amber-400 text-slate-950"
        : "bg-slate-950/80 border-slate-700 text-slate-300 hover:text-white hover:border-slate-500"
    }`}
  >
    {icon}
    {label}
  </button>
);
