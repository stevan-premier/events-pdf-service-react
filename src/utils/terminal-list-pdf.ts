import { jsPDF } from 'jspdf';
import autoTable, { type CellHookData, type CellInput, type RowInput } from 'jspdf-autotable';
import arial from '../assets/fonts/Arial.json';
import arialBold from '../assets/fonts/ArialBold.json';
import narrowBold from '../assets/fonts/ArialNarrowBold.json';
import franklin from '../assets/fonts/Franklin.json';
import type { Translations } from '../services/translations';
import terminalListFontData from '../assets/fonts/RobotoCondensed-TerminalList-Bold.json';

type TerminalListCell = string | number | boolean | null | undefined;
type TerminalListRow = TerminalListCell[];

interface TerminalListEventRow {
  date: string;
  values: TerminalListRow;
}

interface TerminalListSection {
  sport: string;
  marketHeaders: string[];
  rows: TerminalListEventRow[];
}

interface MarketGroup {
  label: string;
  headers: string[];
}

const BASE_HEADERS = ['liga', 'dan', 'čas', 'br.', 'domaćin', 'gost'];
const LINE_MARKET_HEADERS = new Set(['H', 'UP', 'UP1P', 'UPD', 'UPG', 'UPP', 'UG', 'PG', 'HG', 'UPS']);
const FOOTBALL_EXCLUDED_MARKETS = new Set(['1X', '12', 'X2']);



function formatCell(value: TerminalListCell): string {
  return value === null || value === undefined ? '' : String(value);
}

function isDateHeader(row: TerminalListRow): boolean {
  return row.length > 5 && row[0] === null && /^\d{2}\.\d{2}\.\d{4}$/.test(formatCell(row[1]));
}

function normalizeHeader(value: string): string {
  return value.trim().toLocaleLowerCase('sr-Latn-RS');
}

function headersAreEqual(first: string[], second: string[]): boolean {
  return first.length === second.length && first.every((header, index) => header === second[index]);
}

function headersMatch(headers: string[], startIndex: number, expected: string[]): boolean {
  return expected.every(
    (header, offset) => normalizeHeader(headers[startIndex + offset] || '') === normalizeHeader(header),
  );
}


function normalizeMarketHeaders(sport: string, headers: string[]): string[] {
  const basketball = /ko[sš]arka/i.test(sport);
  return headers.map((header, index) => {
    if (basketball && header === 'K1+(PR.)') return 'KP1';
    if (basketball && header === 'K2+(PR.)') return 'KP2';
    if (basketball && header === 'UP' && headers[index + 1] === 'MP') return 'UP1P';
    const base = header.replace(/\+\(PR\.\)/g, '');
    if (['MU', 'MP', 'MT1', 'MT2'].includes(base)) return 'manje';
    if (['VU', 'VP', 'VT1', 'VT2'].includes(base)) return 'više';
    return base;
  });
}

function translatedMarketGroups(section: TerminalListSection, translations: Translations): MarketGroup[] {
  if (!/ko[sš]arka/i.test(section.sport)) return createMarketGroups(section.sport, section.marketHeaders);
  const definitions: Array<[string[], string]> = [
    [['K1','KX','K2'], 'FINAL_SCORE'],
    [['KP1','KP2'], 'FINAL_SCORE_WITH_OT'],
    [['H','H1','H2'], 'HANDICAP_WITH_OVERTIME'],
    [['UP','manje','više'], 'BASKET_POINTS_ON_MATCH_WITH_OVERTIME'],
    [['UP1P','manje','više'], 'NUMBER_OF_POINTS_AT_FIRST_HALF'],
    [['UPD','manje','više'], 'NUMBER_OF_POINTS_TEAM_1_WITH_OVERTIME'],
    [['UPG','manje','više'], 'NUMBER_OF_POINTS_TEAM_2_WITH_OVERTIME'],
  ];
  return createMarketGroups(section.sport, section.marketHeaders).map(group => {
    const definition = definitions.find(([headers]) => headersAreEqual(headers, group.headers));
    if (!definition) return group;
    const key = `BET_GROUP_BASKETBALL_${definition[1]}`;
    return { ...group, label: translations[key] || group.label };
  });
}

function getMarketPatterns(sport: string): MarketGroup[] {
  const finalOutcomeLabel = /ko[sš]arka/i.test(sport)
    ? 'konačan ishod\nregularan deo'
    : 'konačan ishod';

  return [
    { label: finalOutcomeLabel, headers: ['K1', 'KX', 'K2'] },
    { label: 'kon. ishod\n+ produž.', headers: ['KP1', 'KP2'] },
    { label: 'hendikep\nkonačan ishod', headers: ['H', 'H1', 'H2'] },
    { label: 'ukupno', headers: ['UP', 'manje', 'više'] },
    { label: 'ukupno\nprvo poluvreme', headers: ['UP1P', 'manje', 'više'] },
    { label: 'ukupno\ndomaćin', headers: ['UPD', 'manje', 'više'] },
    { label: 'ukupno\ngost', headers: ['UPG', 'manje', 'više'] },
    { label: 'dupla šansa', headers: ['1X', '12', 'X2'] },
    { label: 'poluvreme / kraj', headers: ['1-1', '2-2'] },
    { label: 'golovi\nI poluvreme', headers: ['1+I', '2+I'] },
    { label: 'golovi\nII poluvreme', headers: ['1+II', '2+II'] },
    { label: 'ukupno golova', headers: ['0-2', '2+', '3+', '4+'] },
    { label: 'oba daju gol', headers: ['GG', 'GG3+'] },
    { label: 'konačan ishod', headers: ['K1', 'K2'] },
    { label: 'prvo\npoluvrijeme', headers: ['P1', 'PX', 'P2'] },
    { label: /tenis/i.test(sport) ? 'ukupno\ngemova' : 'ukupno\ngolova', headers: ['UG', 'manje', 'više'] },
    { label: 'ukupno golova\nprvo poluvrijeme', headers: ['PG', 'manje', 'više'] },
    { label: 'uk. golova\npar-nepar', headers: ['PAR', 'NEPAR'] },
    { label: 'prvi set', headers: ['PS1', 'PS2'] },
    { label: 'gemovi\nprvi set', headers: ['UPS', 'PSG6-9', 'PSG10+'] },
    { label: 'hendikep\ngemova', headers: ['HG', 'HG1', 'HG2'] },
    { label: 'tačan rezultat', headers: ['2:0', '2:1', '1:2', '0:2'] },
    { label: 'konačan ishod\ni ukupno golova', headers: ['1&MU', '1&VU', '2&MU', '2&VU'] },
  ];
}

function createMarketGroups(sport: string, headers: string[]): MarketGroup[] {
  const patterns = getMarketPatterns(sport);
  const groups: MarketGroup[] = [];
  let index = 0;

  while (index < headers.length) {
    const pattern = patterns.find((candidate) => headersMatch(headers, index, candidate.headers));

    if (pattern) {
      groups.push(pattern);
      index += pattern.headers.length;
      continue;
    }

    const unknownHeaders: string[] = [];

    while (
      index < headers.length &&
      !patterns.some((candidate) => headersMatch(headers, index, candidate.headers))
    ) {
      unknownHeaders.push(headers[index]);
      index += 1;
    }

    groups.push({ label: 'kvote', headers: unknownHeaders });
  }

  return groups;
}

function getDayLabel(date: string): string {
  const [day, month, year] = date.split('.').map(Number);

  if (!day || !month || !year) {
    return '';
  }

  return ['ned', 'pon', 'uto', 'sre', 'čet', 'pet', 'sub'][
    new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  ];
}

function getFullDayLabel(date: string): string {
  const [day, month, year] = date.split('.').map(Number);

  if (!day || !month || !year) {
    return '';
  }

  return ['Nedelja', 'Ponedeljak', 'Utorak', 'Sreda', 'Cetvrtak', 'Petak', 'Subota'][
    new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  ];
}

function isFootballSport(sport: string): boolean {
  return /fudbal|football/i.test(sport);
}

function formatMarketCell(value: TerminalListCell, header: string): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  const numericValue = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(numericValue)) {
    return String(value);
  }

  if (numericValue === 0) {
    return '-';
  }

  if (LINE_MARKET_HEADERS.has(header.toLocaleUpperCase('sr-Latn-RS'))) {
    return (Number.isInteger(numericValue) ? String(numericValue) : numericValue.toFixed(1)).replace('.', ',');
  }

  return numericValue.toFixed(2).replace('.', ',');
}

function formatFootballMarketCell(value: TerminalListCell): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  const numericValue = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(numericValue)) {
    return String(value);
  }

  return numericValue.toFixed(2).replace(/0$/, '');
}

function parseTerminalList(data: unknown): {
  generatedAt: string;
  sport: string;
  sections: TerminalListSection[];
} {
  const payload =
    !Array.isArray(data) && data && typeof data === 'object' && 'data' in data
      ? (data as { data: unknown }).data
      : data;

  if (!Array.isArray(payload)) {
    throw new Error('Server nije vratio ispravne podatke za listu.');
  }

  const rows = payload.filter(Array.isArray) as TerminalListRow[];
  const generatedAt = formatCell(rows.find((row) => row.length === 1 && /\d{2}\/\d{2}\/\d{4}/.test(formatCell(row[0])))?.[0]);
  const sport = formatCell(
    rows.find(
      (row) =>
        row.length === 1 &&
        Boolean(formatCell(row[0])) &&
        !/\d{2}\/\d{2}\/\d{4}/.test(formatCell(row[0])),
    )?.[0],
  );
  const sections: TerminalListSection[] = [];
  let currentSport = '';
  let currentDate = '';
  let currentSection: TerminalListSection | null = null;

  rows.forEach((row) => {
    if (
      row.length === 1 &&
      Boolean(formatCell(row[0])) &&
      !/\d{2}\/\d{2}\/\d{4}/.test(formatCell(row[0]))
    ) {
      currentSport = formatCell(row[0]);
      currentDate = '';
      currentSection = null;
      return;
    }

    if (isDateHeader(row)) {
      currentDate = formatCell(row[1]);
      const marketHeaders = normalizeMarketHeaders(currentSport, row.slice(5).map(formatCell));
      const previousSection = sections[sections.length - 1];

      if (
        previousSection &&
        previousSection.sport === currentSport &&
        headersAreEqual(previousSection.marketHeaders, marketHeaders)
      ) {
        currentSection = previousSection;
      } else {
        currentSection = {
          sport: currentSport,
          marketHeaders,
          rows: [],
        };
        sections.push(currentSection);
      }
      return;
    }

    if (currentSection && row.length > 5) {
      currentSection.rows.push({ date: currentDate, values: row });
    }
  });

  if (!sections.some((section) => section.rows.length > 0)) {
    throw new Error('Trenutno nema događaja za izabranu listu.');
  }

  return { generatedAt, sport, sections };
}

function createTableHead(section: TerminalListSection, translations: Translations): RowInput[] {
  const title = section.sport.replace(/^Kosarka$/i, 'Košarka').toLocaleUpperCase('sr-Latn-RS');
  const groupRow: CellInput[] = [
    {
      content: title || 'TERMINSKA LISTA',
      colSpan: BASE_HEADERS.length,
      styles: {
        fillColor: [249, 198, 147],
        fontSize: 20.06,
        fontStyle: 'bold',
        halign: 'center',
        valign: 'middle',
        minCellHeight: 15.65,
      },
    },
    ...translatedMarketGroups(section, translations).map((group) => ({
      content: group.label,
      colSpan: group.headers.length,
      styles: {
        fillColor: [255, 255, 255] as [number, number, number],
        fontSize: 8.96,
        fontStyle: 'bold' as const,
        halign: 'center' as const,
        valign: 'middle' as const,
      },
    })),
  ];
  const marketHeaders: CellInput[] = section.marketHeaders.map((header) => ({
    content: header,
    styles: LINE_MARKET_HEADERS.has(header.toLocaleUpperCase('sr-Latn-RS'))
      ? { fillColor: [255, 242, 0], textColor: 0 }
      : { fillColor: [255, 255, 255], textColor: 0 },
  }));

  return [groupRow, [...BASE_HEADERS, ...marketHeaders]];
}

function createTableBody(section: TerminalListSection): RowInput[] {
  return section.rows.map((row) => [
    formatCell(row.values[0]),
    getDayLabel(row.date),
    formatCell(row.values[1]),
    formatCell(row.values[2]),
    formatCell(row.values[3]),
    formatCell(row.values[4]),
    ...section.marketHeaders.map((header, index) => formatMarketCell(row.values[index + 5], header)),
  ]);
}

function getFootballMarkets(section: TerminalListSection): Array<{ header: string; index: number }> {
  return section.marketHeaders
    .map((header, index) => ({ header, index }))
    .filter(({ header }) => !FOOTBALL_EXCLUDED_MARKETS.has(header.toLocaleUpperCase('sr-Latn-RS')));
}

function createFootballTableHead(section: TerminalListSection, date: string): RowInput[] {
  const markets = getFootballMarkets(section);
  const formattedDate = date.replace(/\./g, '/');
  const dateTitle = [getFullDayLabel(date), formattedDate].filter(Boolean).join(' ');
  const footballGroups: MarketGroup[] = [
    { label: 'konačan ishod', headers: ['K1', 'KX', 'K2'] },
    { label: "45'/90'", headers: ['1-1', '2-2'] },
    { label: 'golovi poluvrijeme', headers: ['1+I', '2+I', '1+II', '2+II'] },
    { label: 'ukupno golova', headers: ['0-2', '2+', '3+', '4+'] },
    { label: 'gol-gol', headers: ['GG', 'GG3+'] },
  ];
  const marketHeaders = markets.map(({ header }) => header);
  const groups = footballGroups.filter((group) =>
    group.headers.every((header) => marketHeaders.includes(header)),
  );
  const groupedHeaders = new Set(groups.flatMap((group) => group.headers));
  const ungroupedHeaders = marketHeaders.filter((header) => !groupedHeaders.has(header));
  const groupRow: CellInput[] = [
    {
      content: dateTitle,
      colSpan: 5,
      rowSpan: 2,
      styles: {
        fillColor: [255, 255, 255],
        fontSize: 10,
        fontStyle: 'bold',
        halign: 'center',
        valign: 'middle',
      },
    },
    ...groups.map((group) => ({
      content: group.label,
      colSpan: group.headers.length,
      styles: {
        fillColor: [215, 215, 215] as [number, number, number],
        textColor: 0,
        fontSize: 8.96,
        fontStyle: 'bold' as const,
        halign: 'center' as const,
        valign: 'middle' as const,
      },
    })),
    ...(ungroupedHeaders.length
      ? [
          {
            content: 'kvote',
            colSpan: ungroupedHeaders.length,
            styles: {
              fillColor: [215, 215, 215] as [number, number, number],
              textColor: 0,
              fontSize: 8.96,
              fontStyle: 'bold' as const,
              halign: 'center' as const,
              valign: 'middle' as const,
            },
          },
        ]
      : []),
  ];
  const leafRow: CellInput[] = marketHeaders.map((header) => ({
    content: header,
    styles: {
      fillColor: [67, 148, 174],
      textColor: 255,
      fontStyle: 'bold',
      halign: 'center',
    },
  }));

  return [groupRow, leafRow];
}

function createFootballTableBody(section: TerminalListSection, rows: TerminalListEventRow[]): RowInput[] {
  const markets = getFootballMarkets(section);

  return rows.map((row) => [
    formatCell(row.values[0]),
    formatCell(row.values[1]),
    formatCell(row.values[2]),
    formatCell(row.values[3]),
    formatCell(row.values[4]),
    ...markets.map(({ index }) => formatFootballMarketCell(row.values[index + 5])),
  ]);
}

function groupRowsByDate(rows: TerminalListEventRow[]): Array<{ date: string; rows: TerminalListEventRow[] }> {
  return rows.reduce<Array<{ date: string; rows: TerminalListEventRow[] }>>((groups, row) => {
    const currentGroup = groups[groups.length - 1];

    if (currentGroup?.date === row.date) {
      currentGroup.rows.push(row);
    } else {
      groups.push({ date: row.date, rows: [row] });
    }

    return groups;
  }, []);
}

export function createTerminalListPdf(data: unknown, fontData: string | null = terminalListFontData, translations: Translations = {}): jsPDF {
  const { generatedAt, sport, sections } = parseTerminalList(data);
  const sportOrder = ['fudbal', 'kosarka', 'rukomet', 'odbojka', 'hokej', 'tenis', 'nfl', 'ragbi', 'rugby', 'bejzbol'];
  const sportRank = (name: string) => {
    const rank = sportOrder.indexOf(name.toLowerCase().replace('š', 's'));
    return rank === -1 ? sportOrder.length : rank;
  };
  sections.sort((a, b) => sportRank(a.sport) - sportRank(b.sport));
  const document = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: isFootballSport(sport) ? 'a4' : [313.3937, 443.3641],
  });
  const pageHeight = document.internal.pageSize.getHeight();
  const pageWidth = document.internal.pageSize.getWidth();
  let currentY = 2;
  const fontName = 'Franklin';
  for (const [file, data, name, style] of [
    ['Arial.ttf', arial, 'Arial', 'normal'],
    ['ArialBold.ttf', arialBold, 'Arial', 'bold'],
    ['ArialNarrowBold.ttf', narrowBold, 'Narrow', 'bold'],
    ['Franklin.ttf', franklin, 'Franklin', 'normal'],
    ['FranklinBold.ttf', franklin, 'Franklin', 'bold'],
  ]) {
    document.addFileToVFS(file, data);
    document.addFont(file, name, style);
  }
  // Retain compatibility with callers that supply the previous optional font.
  void fontData;
  document.setDisplayMode('fullwidth');

  document.setProperties({
    title: `${sport || 'Terminska lista'} - ${generatedAt}`,
    subject: 'Terminska lista',
  });

  sections.forEach((section) => {
    if (!section.rows.length) {
      return;
    }

    const isFootball = isFootballSport(section.sport);
    const tableParts = isFootball
      ? groupRowsByDate(section.rows)
      : [{ date: '', rows: section.rows }];

    tableParts.forEach((tablePart) => {
      if (currentY > pageHeight - 45) {
        document.addPage();
        currentY = 2;
      }

      const baseColumnCount = isFootball ? 5 : BASE_HEADERS.length;
      const displayedMarketHeaders = isFootball
        ? getFootballMarkets(section).map(({ header }) => header)
        : section.marketHeaders;

      autoTable(document, {
        startY: currentY,
        head: isFootball
          ? createFootballTableHead(section, tablePart.date)
          : createTableHead(section, translations),
        body: isFootball
          ? createFootballTableBody(section, tablePart.rows)
          : createTableBody(section),
        theme: 'grid',
        showHead: 'everyPage',
        margin: { top: 2, right: 2, bottom: 5, left: 2 },
        tableLineColor: 0,
        tableLineWidth: 0.2,
        styles: {
          font: isFootball ? 'Arial' : fontName,
          fontStyle: 'normal',
          fontSize: isFootball ? 8 : 10.03,
          textColor: 0,
          fillColor: [255, 255, 255],
          cellPadding: isFootball ? 0.3 : 0.35,
          overflow: 'hidden',
          minCellHeight: isFootball ? 5 : 7.85,
          valign: 'middle',
          lineColor: 0,
          lineWidth: 0.2,
        },
        headStyles: {
          fillColor: [255, 255, 255],
          textColor: 0,
          fontStyle: 'bold',
          halign: 'center',
          valign: 'middle',
          lineColor: 0,
          lineWidth: 0.2,
        },
        bodyStyles: {
          fillColor: [255, 255, 255],
          textColor: 0,
        },
        alternateRowStyles: {
          fillColor: isFootball ? [204, 245, 245] : [255, 255, 255],
        },
        columnStyles: Object.fromEntries([
          ...(isFootball ? [35, 8.5, 8.5, 25, 25] : [21, 8.4, 9, 8.4, 39.2, 39.2])
            .map((cellWidth, index) => [index, { cellWidth, halign: index === 0 || index >= (isFootball ? 3 : 4) ? 'left' : 'center' }]),
          ...displayedMarketHeaders.map((_, index) => [index + baseColumnCount, {
            cellWidth: isFootball ? (pageWidth - 106) / displayedMarketHeaders.length : 9.23,
            halign: 'center',
          }]),
        ]),
        tableWidth: isFootball ? pageWidth - 4 : 125.2 + displayedMarketHeaders.length * 9.23,
        rowPageBreak: 'avoid',
        didParseCell: (hookData: CellHookData) => {
          if (hookData.section === 'head') {
            hookData.cell.styles.overflow = 'linebreak';
            hookData.cell.styles.font = isFootball ? 'Arial' : 'Narrow';
            hookData.cell.styles.fontStyle = isFootball && hookData.cell.colSpan < 5 ? 'normal' : 'bold';
            if (isFootball && hookData.cell.colSpan < 5) hookData.cell.styles.fontSize = 5.5;
            if (!isFootball && hookData.row.index === 1) {
              hookData.cell.styles.fontSize = 8.96;
              hookData.cell.styles.overflow = 'hidden';
              if (hookData.column.index >= baseColumnCount) {
                document.setFont('Narrow', 'bold');
                document.setFontSize(8.96);
                const width = document.getTextWidth(hookData.cell.text.join(''));
                if (width > 8.53) hookData.cell.styles.fontSize = 8.96 * 8.53 / width;
              }
            }
          }
          if (!isFootball && hookData.section === 'body' && [4, 5].includes(hookData.column.index)) {
            hookData.cell.styles.overflow = 'linebreak';
          }
          if (hookData.section === 'body' && hookData.column.index >= baseColumnCount) {
            hookData.cell.styles.font = 'Narrow';
            hookData.cell.styles.fontStyle = 'bold';
            hookData.cell.styles.fontSize = isFootball ? 6.5 : 10.03;
            // Numeric values must never wrap or disappear, even for long odds.
            const value = hookData.cell.text.join('');
            document.setFont('Narrow', 'bold');
            document.setFontSize(hookData.cell.styles.fontSize);
            const available = (isFootball ? (pageWidth - 106) / displayedMarketHeaders.length : 9.23) - 0.7;
            const width = document.getTextWidth(value);
            if (width > available) hookData.cell.styles.fontSize *= available / width;
          }
          if (hookData.section !== 'body' || hookData.column.index < baseColumnCount) {
            return;
          }

          const marketHeader = displayedMarketHeaders[hookData.column.index - baseColumnCount];

          hookData.cell.styles.halign = 'center';
          if (!isFootball && LINE_MARKET_HEADERS.has(marketHeader?.toLocaleUpperCase('sr-Latn-RS'))) {
            hookData.cell.styles.fillColor = [194, 255, 178];
          }
        },
        didDrawPage: () => {
          document.setFont(fontName, 'normal');
          document.setFontSize(6);
          if (generatedAt) {
            document.text(`Generisano: ${generatedAt}`, 4, pageHeight - 3);
          }
          document.text(
            `Strana ${document.getCurrentPageInfo().pageNumber}`,
            pageWidth - 4,
            pageHeight - 3,
            { align: 'right' },
          );
        },
      });

      currentY =
        ((document as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || currentY) +
        (isFootball ? 0 : 0);
    });
  });

  return document;
}

export async function downloadTerminalListPdf(data: unknown, fileName: string): Promise<void> {
  const pdfDocument = createTerminalListPdf(data, terminalListFontData);

  const blob = pdfDocument.output('blob');
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = objectUrl;
  link.download = fileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

