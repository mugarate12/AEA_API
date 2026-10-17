import { StandardFonts, rgb, LineCapStyle } from 'pdf-lib';

// Dimensões do carimbo em pontos PDF (1pt = 1/72"). O preview (src/index.ejs)
// usa os mesmos valores para desenhar o placeholder arrastável.
export const STAMP_WIDTH = 260;
export const STAMP_HEIGHT = 84;

const TAB_HEIGHT = 12;
const CARD_TOP = TAB_HEIGHT / 2; // a aba fica centralizada sobre a borda superior
const CARD_RADIUS = 6;
const PADDING_X = 12;

const TAB_TEXT = 'DOCUMENTO ASSINADO ELETRONICAMENTE';
const TIME_ZONE = 'America/Sao_Paulo';

function hex(color) {
    const value = Number.parseInt(color.slice(1), 16);
    return rgb(((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255);
}

// Paleta institucional compartilhada com os PDFs do frontend.
const COLORS = {
    primary: hex('#1f7a3c'),
    primaryDark: hex('#14532d'),
    text: hex('#1f2937'),
    muted: hex('#6b7280'),
    border: hex('#c9d9cd'),
    white: rgb(1, 1, 1),
};

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
});

/**
 * Formata a data no horário de Brasília, independente do fuso/locale do servidor.
 * @param {Date} date
 * @returns {string} ex.: "11/10/2026 às 14:27:53"
 */
export function formatSignatureDate(date) {
    const parts = Object.fromEntries(
        dateTimeFormatter.formatToParts(date).map((part) => [part.type, part.value]),
    );

    return `${parts.day}/${parts.month}/${parts.year} às ${parts.hour}:${parts.minute}:${parts.second}`;
}

/**
 * Remove caracteres que a fonte padrão (WinAnsi) não consegue codificar,
 * para que o desenho do texto nunca lance exceção.
 */
function sanitize(text, font) {
    const supported = new Set(font.getCharacterSet());

    return Array.from(String(text ?? '').normalize('NFC').replace(/\s+/g, ' ').trim())
        .map((char) => {
            if (supported.has(char.codePointAt(0))) return char;

            // Tenta a versão sem acento (ex.: "ő" -> "o") antes de descartar.
            const base = char.normalize('NFD').replace(/[̀-ͯ]/g, '');
            return base && Array.from(base).every((c) => supported.has(c.codePointAt(0))) ? base : '?';
        })
        .join('');
}

/** Corta o texto com "…" para caber em maxWidth. */
function fitText(text, font, size, maxWidth) {
    if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;

    const ellipsis = '…';
    let chars = Array.from(text);

    while (chars.length && font.widthOfTextAtSize(chars.join('') + ellipsis, size) > maxWidth) {
        chars = chars.slice(0, -1);
    }

    return chars.join('').trimEnd() + ellipsis;
}

/** Path SVG de retângulo arredondado com origem no canto superior esquerdo. */
function roundedRectPath(width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);

    return [
        `M ${r} 0`,
        `H ${width - r}`,
        `A ${r} ${r} 0 0 1 ${width} ${r}`,
        `V ${height - r}`,
        `A ${r} ${r} 0 0 1 ${width - r} ${height}`,
        `H ${r}`,
        `A ${r} ${r} 0 0 1 0 ${height - r}`,
        `V ${r}`,
        `A ${r} ${r} 0 0 1 ${r} 0`,
        'Z',
    ].join(' ');
}

// Escudo 20x24 e o "check" interno, em coordenadas SVG (y para baixo).
const SHIELD_PATH = 'M 10 0 L 20 3.6 V 10.8 C 20 17.2 15.8 21.8 10 24 C 4.2 21.8 0 17.2 0 10.8 V 3.6 Z';
const CHECK_PATH = 'M 5.6 12.2 L 8.9 15.4 L 14.6 9';

/**
 * Desenha o carimbo de assinatura eletrônica (cartão institucional) na página.
 *
 * @param {import('pdf-lib').PDFDocument} pdfDoc
 * @param {import('pdf-lib').PDFPage} page
 * @param {object} data
 * @param {number} data.x - canto superior esquerdo (coordenadas PDF)
 * @param {number} data.y - canto superior esquerdo (coordenadas PDF, a partir da base da página)
 * @param {string} data.name
 * @param {string} data.email
 * @param {Date} data.signedAt
 * @param {string} data.documentId
 */
export async function drawSignatureStamp(pdfDoc, page, { x, y, name, email, signedAt, documentId }) {
    const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Mantém o carimbo inteiro dentro da área visível da página.
    // A margem de 1pt evita que metade da borda fique fora da página.
    const box = page.getCropBox();
    const edge = 1;
    const left = clamp(Number(x) || 0, box.x + edge, box.x + box.width - STAMP_WIDTH - edge);
    const top = clamp(Number(y) || 0, box.y + STAMP_HEIGHT + edge, box.y + box.height - edge);

    const cardHeight = STAMP_HEIGHT - CARD_TOP;
    const cardTop = top - CARD_TOP;
    const contentWidth = STAMP_WIDTH - PADDING_X * 2;

    // Cartão
    page.drawSvgPath(roundedRectPath(STAMP_WIDTH, cardHeight, CARD_RADIUS), {
        x: left,
        y: cardTop,
        color: COLORS.white,
        borderColor: COLORS.primary,
        borderWidth: 1,
    });

    // Aba superior
    const tabSize = 6;
    const tabText = sanitize(TAB_TEXT, bold);
    const tabWidth = bold.widthOfTextAtSize(tabText, tabSize) + 14;
    page.drawSvgPath(roundedRectPath(tabWidth, TAB_HEIGHT, 3), {
        x: left + PADDING_X,
        y: top,
        color: COLORS.primary,
    });
    page.drawText(tabText, {
        x: left + PADDING_X + 7,
        y: top - TAB_HEIGHT / 2 - tabSize * 0.35,
        size: tabSize,
        font: bold,
        color: COLORS.white,
    });

    // Ícone (escudo com check)
    const iconTop = cardTop - 14;
    page.drawSvgPath(SHIELD_PATH, { x: left + PADDING_X, y: iconTop, color: COLORS.primary });
    page.drawSvgPath(CHECK_PATH, {
        x: left + PADDING_X,
        y: iconTop,
        borderColor: COLORS.white,
        borderWidth: 1.8,
        borderLineCap: LineCapStyle.Round,
    });

    // Nome e e-mail
    const textLeft = left + PADDING_X + 20 + 9;
    const textWidth = left + STAMP_WIDTH - PADDING_X - textLeft;
    const nameSize = 9.5;
    const emailSize = 7.5;
    page.drawText(fitText(sanitize(name, bold).toUpperCase(), bold, nameSize, textWidth), {
        x: textLeft,
        y: iconTop - 9.5,
        size: nameSize,
        font: bold,
        color: COLORS.text,
    });
    page.drawText(fitText(sanitize(email, regular), regular, emailSize, textWidth), {
        x: textLeft,
        y: iconTop - 20.5,
        size: emailSize,
        font: regular,
        color: COLORS.muted,
    });

    // Divisor
    const dividerY = iconTop - 31;
    page.drawLine({
        start: { x: left + PADDING_X, y: dividerY },
        end: { x: left + STAMP_WIDTH - PADDING_X, y: dividerY },
        thickness: 0.6,
        color: COLORS.border,
    });

    // Duas colunas: data/hora e código do documento
    const labelSize = 6.5;
    const columnGap = 10;
    const firstColumnWidth = contentWidth * 0.52;
    const secondColumnLeft = left + PADDING_X + firstColumnWidth + columnGap;
    const secondColumnWidth = left + STAMP_WIDTH - PADDING_X - secondColumnLeft;
    const labelY = dividerY - 11;
    const valueY = labelY - 10.5;

    page.drawText('Data e hora da assinatura:', {
        x: left + PADDING_X,
        y: labelY,
        size: labelSize,
        font: regular,
        color: COLORS.muted,
    });
    page.drawText(fitText(formatSignatureDate(signedAt ?? new Date()), bold, 8, firstColumnWidth), {
        x: left + PADDING_X,
        y: valueY,
        size: 8,
        font: bold,
        color: COLORS.primaryDark,
    });

    page.drawText('Código do documento:', {
        x: secondColumnLeft,
        y: labelY,
        size: labelSize,
        font: regular,
        color: COLORS.muted,
    });
    page.drawText(fitText(sanitize(documentId, bold), bold, 7, secondColumnWidth), {
        x: secondColumnLeft,
        y: valueY,
        size: 7,
        font: bold,
        color: COLORS.text,
    });
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), Math.max(min, max));
}
