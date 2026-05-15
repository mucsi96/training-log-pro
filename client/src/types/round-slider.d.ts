declare module 'round-slider';

interface RoundSliderArgs {
  value: number;
}

interface RoundSliderOptions {
  min?: number;
  max?: number;
  step?: number;
  value?: number;
  radius?: number;
  width?: number;
  handleSize?: number | string;
  startAngle?: number;
  endAngle?: number | string;
  animation?: boolean;
  showTooltip?: boolean;
  editableTooltip?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
  keyboardAction?: boolean;
  mouseScrollAction?: boolean;
  lineCap?: 'butt' | 'round';
  sliderType?: 'default' | 'min-range' | 'range';
  circleShape?: 'full' | 'half' | 'quarter' | 'pie';
  handleShape?: 'round' | 'square' | 'dot';
  borderWidth?: number;
  borderColor?: string | null;
  pathColor?: string | null;
  rangeColor?: string | null;
  tooltipColor?: string | null;
  svgMode?: boolean;
  change?: (args: RoundSliderArgs) => void;
  drag?: (args: RoundSliderArgs) => void;
  valueChange?: (args: RoundSliderArgs) => void;
  tooltipFormat?: (args: RoundSliderArgs) => string;
}

interface JQuery {
  roundSlider(options?: RoundSliderOptions | string, value?: unknown): JQuery;
}
