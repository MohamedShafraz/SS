import type {
  BarcodeStickerFieldAlignment,
  BarcodeStickerFieldId,
  BarcodeStickerPreset,
  BusinessProfile,
} from "@/types";

type BarcodeFieldBooleanKey =
  | "showProductName"
  | "showSellingPrice"
  | "showLeastPrice"
  | "showLeastPriceCode"
  | "showBarcodeText"
  | "showBusinessName"
  | "showBusinessAddress"
  | "showBusinessPhone";

export type BarcodeFieldDefinition = {
  id: BarcodeStickerFieldId;
  label: string;
  showKey?: BarcodeFieldBooleanKey;
};

export const BARCODE_FIELD_DEFINITIONS: BarcodeFieldDefinition[] = [
  { id: "businessName", label: "Business Name", showKey: "showBusinessName" },
  { id: "businessAddress", label: "Business Address", showKey: "showBusinessAddress" },
  { id: "businessPhone", label: "Business Phone", showKey: "showBusinessPhone" },
  { id: "productName", label: "Product Name", showKey: "showProductName" },
  { id: "barcodeImage", label: "Barcode" },
  { id: "barcodeText", label: "Barcode Text", showKey: "showBarcodeText" },
  { id: "sellingPrice", label: "Selling Price", showKey: "showSellingPrice" },
  { id: "leastPrice", label: "Least Price", showKey: "showLeastPrice" },
  { id: "leastPriceCode", label: "Least Code", showKey: "showLeastPriceCode" },
];

export const DEFAULT_BARCODE_FIELD_ORDER = BARCODE_FIELD_DEFINITIONS.map(
  (field) => field.id
);

const BARCODE_FIELD_IDS = new Set<BarcodeStickerFieldId>(DEFAULT_BARCODE_FIELD_ORDER);

function normalizeFieldOrder(value: unknown): BarcodeStickerFieldId[] {
  const seen = new Set<BarcodeStickerFieldId>();
  const order = Array.isArray(value)
    ? value.filter((field): field is BarcodeStickerFieldId => {
        if (!BARCODE_FIELD_IDS.has(field) || seen.has(field)) return false;
        seen.add(field);
        return true;
      })
    : [];

  return [
    ...order,
    ...DEFAULT_BARCODE_FIELD_ORDER.filter((field) => !seen.has(field)),
  ];
}

function normalizeFieldGaps(value: unknown) {
  const gaps = value && typeof value === "object" ? value as Record<string, unknown> : {};

  return DEFAULT_BARCODE_FIELD_ORDER.reduce((acc, field) => {
    acc[field] = Math.max(0, Number(gaps[field] || 0));
    return acc;
  }, {} as Record<BarcodeStickerFieldId, number>);
}

function normalizeFieldAlignments(value: unknown) {
  const alignments = value && typeof value === "object" ? value as Record<string, unknown> : {};

  return DEFAULT_BARCODE_FIELD_ORDER.reduce((acc, field) => {
    const alignment = alignments[field];
    acc[field] = alignment === "left" || alignment === "right" ? alignment : "center";
    return acc;
  }, {} as Record<BarcodeStickerFieldId, BarcodeStickerFieldAlignment>);
}

export const BUILT_IN_BARCODE_PRESETS: BarcodeStickerPreset[] = [
  {
    id: "builtin-ga-2408t-102mm-3up-25mm",
    name: "GA-2408T 3-up (Vertical roll feed)",
    builtIn: true,
    stickerWidthMm: 31.33,
    stickerHeightMm: 25,
    columns: 3,
    rows: 1,
    maxRollLengthMm: 25,
    columnGapMm: 4,
    rowGapMm: 0,
    marginLeftMm: 0,
    marginRightMm: 0,
    marginTopMm: 0,
    marginBottomMm: 0,
    barcodeHeightMm: 10.8,
    barcodeBarWidth: 1.35,
    // This media is physically 102mm wide with three labels across. The roll
    // feed direction must not rotate or reflow the page into a single column.
    orientation: "horizontal",
    productNameFontSize: 7,
    sellingPriceFontSize: 12,
    leastPriceFontSize: 8,
    leastPriceCodeFontSize: 12,
    barcodeTextFontSize: 6,
    businessInfoFontSize: 7,
    businessAddressFontSize: 6,
    businessPhoneFontSize: 6,
    showProductName: true,
    showSellingPrice: true,
    showLeastPrice: false,
    showLeastPriceCode: true,
    showBarcodeText: true,
    showBusinessName: true,
    showBusinessAddress: true,
    showBusinessPhone: true,
  },
  {
    id: "builtin-2-column-compact",
    name: "2-column compact",
    builtIn: true,
    stickerWidthMm: 50,
    stickerHeightMm: 25,
    columns: 2,
    rows: 10,
    maxRollLengthMm: 250,
    columnGapMm: 2,
    rowGapMm: 2,
    marginLeftMm: 2,
    marginRightMm: 2,
    marginTopMm: 2,
    marginBottomMm: 2,
    barcodeHeightMm: 10,
    barcodeBarWidth: 1.3,
    orientation: "horizontal",
    productNameFontSize: 8,
    sellingPriceFontSize: 12,
    leastPriceFontSize: 9,
    leastPriceCodeFontSize: 11,
    barcodeTextFontSize: 7,
    businessInfoFontSize: 7,
    businessAddressFontSize: 6,
    businessPhoneFontSize: 6,
    showProductName: true,
    showSellingPrice: true,
    showLeastPrice: true,
    showLeastPriceCode: true,
    showBarcodeText: true,
    showBusinessName: false,
    showBusinessAddress: false,
    showBusinessPhone: false,
  },
  {
    id: "builtin-single-50x25",
    name: "Single 50x25mm",
    builtIn: true,
    stickerWidthMm: 50,
    stickerHeightMm: 25,
    columns: 1,
    rows: 1,
    maxRollLengthMm: 250,
    columnGapMm: 0,
    rowGapMm: 2,
    marginLeftMm: 2,
    marginRightMm: 2,
    marginTopMm: 2,
    marginBottomMm: 2,
    barcodeHeightMm: 10,
    barcodeBarWidth: 1.3,
    orientation: "horizontal",
    productNameFontSize: 8,
    sellingPriceFontSize: 12,
    leastPriceFontSize: 9,
    leastPriceCodeFontSize: 11,
    barcodeTextFontSize: 7,
    businessInfoFontSize: 7,
    businessAddressFontSize: 6,
    businessPhoneFontSize: 6,
    showProductName: true,
    showSellingPrice: true,
    showLeastPrice: true,
    showLeastPriceCode: true,
    showBarcodeText: true,
    showBusinessName: false,
    showBusinessAddress: false,
    showBusinessPhone: false,
  },
  {
    id: "builtin-single-60x40",
    name: "Single 60x40mm",
    builtIn: true,
    stickerWidthMm: 60,
    stickerHeightMm: 40,
    columns: 1,
    rows: 1,
    maxRollLengthMm: 250,
    columnGapMm: 0,
    rowGapMm: 2,
    marginLeftMm: 3,
    marginRightMm: 3,
    marginTopMm: 3,
    marginBottomMm: 3,
    barcodeHeightMm: 16,
    barcodeBarWidth: 1.6,
    orientation: "horizontal",
    productNameFontSize: 10,
    sellingPriceFontSize: 15,
    leastPriceFontSize: 11,
    leastPriceCodeFontSize: 13,
    barcodeTextFontSize: 8,
    businessInfoFontSize: 8,
    businessAddressFontSize: 7,
    businessPhoneFontSize: 7,
    showProductName: true,
    showSellingPrice: true,
    showLeastPrice: true,
    showLeastPriceCode: true,
    showBarcodeText: true,
    showBusinessName: false,
    showBusinessAddress: false,
    showBusinessPhone: false,
  },
];

export function getBarcodePresets(settings: Partial<BusinessProfile> | null | undefined) {
  return [
    ...BUILT_IN_BARCODE_PRESETS,
    ...((settings?.barcodeStickerCustomPresets || []).map((preset) =>
      normalizeBarcodePreset({ ...preset, builtIn: false })
    )),
  ];
}

export function getActiveBarcodePreset(settings: Partial<BusinessProfile> | null | undefined) {
  const presets = getBarcodePresets(settings);
  return normalizeBarcodePreset(
    presets.find((preset) => preset.id === settings?.barcodeStickerPresetId) ||
    BUILT_IN_BARCODE_PRESETS[0]
  );
}

export function normalizeBarcodePreset(value: BarcodeStickerPreset): BarcodeStickerPreset {
  const base = {
    ...BUILT_IN_BARCODE_PRESETS[0],
    ...value,
  };

  return {
    ...base,
    stickerWidthMm: Math.max(10, Number(base.stickerWidthMm || 50)),
    stickerHeightMm: Math.max(10, Number(base.stickerHeightMm || 25)),
    columns: Math.max(1, Math.floor(Number(base.columns || 1))),
    rows: Math.max(1, Math.floor(Number(base.rows || 1))),
    maxRollLengthMm: Math.max(10, Number(base.maxRollLengthMm || 250)),
    columnGapMm: Math.max(0, Number(base.columnGapMm || 0)),
    rowGapMm: Math.max(0, Number(base.rowGapMm || 0)),
    marginLeftMm: Math.max(0, Number(base.marginLeftMm || 0)),
    marginRightMm: Math.max(0, Number(base.marginRightMm || 0)),
    marginTopMm: Math.max(0, Number(base.marginTopMm || 0)),
    marginBottomMm: Math.max(0, Number(base.marginBottomMm || 0)),
    barcodeHeightMm: Math.max(5, Number(base.barcodeHeightMm || 10)),
    barcodeBarWidth: Math.max(0.8, Number(base.barcodeBarWidth || 1.3)),
    productNameFontSize: Math.max(4, Number(base.productNameFontSize || 7)),
    sellingPriceFontSize: Math.max(4, Number(base.sellingPriceFontSize || 12)),
    leastPriceFontSize: Math.max(4, Number(base.leastPriceFontSize || 8)),
    leastPriceCodeFontSize: Math.max(4, Number(base.leastPriceCodeFontSize || 12)),
    barcodeTextFontSize: Math.min(
      12,
      Math.max(
        4,
        Number(
          value.barcodeTextFontSize ??
            Math.max(6, Number(value.businessInfoFontSize || base.businessInfoFontSize || 7))
        )
      )
    ),
    businessInfoFontSize: Math.max(4, Number(base.businessInfoFontSize || 7)),
    businessAddressFontSize: Math.max(4, Number(base.businessAddressFontSize || Math.max(5, Number(base.businessInfoFontSize || 7) - 1))),
    businessPhoneFontSize: Math.max(4, Number(base.businessPhoneFontSize || Math.max(5, Number(base.businessInfoFontSize || 7) - 1))),
    fieldOrder: normalizeFieldOrder(base.fieldOrder),
    fieldGapsMm: normalizeFieldGaps(base.fieldGapsMm),
    fieldAlignments: normalizeFieldAlignments(base.fieldAlignments),
    // Presets saved by older versions did not have this field and historically
    // printed horizontally, so only an explicit vertical value rotates them.
    orientation: value.orientation === "vertical" ? "vertical" : "horizontal",
  };
}

export function isBarcodeFieldVisible(
  preset: BarcodeStickerPreset,
  field: BarcodeStickerFieldId
) {
  const definition = BARCODE_FIELD_DEFINITIONS.find((item) => item.id === field);
  return definition?.showKey ? Boolean(preset[definition.showKey]) : true;
}

export function getVisibleBarcodeFields(preset: BarcodeStickerPreset) {
  return (preset.fieldOrder || DEFAULT_BARCODE_FIELD_ORDER).filter((field) =>
    isBarcodeFieldVisible(preset, field)
  );
}

export function getBarcodeFieldGapMm(
  preset: BarcodeStickerPreset,
  field: BarcodeStickerFieldId
) {
  return Math.max(0, Number(preset.fieldGapsMm?.[field] || 0));
}

export function getBarcodeFieldAlignment(
  preset: BarcodeStickerPreset,
  field: BarcodeStickerFieldId
) {
  const alignment = preset.fieldAlignments?.[field];
  return alignment === "left" || alignment === "right" ? alignment : "center";
}
