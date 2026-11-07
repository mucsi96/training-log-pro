import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { BarChart, LineChart } from 'echarts/charts';
import { AriaComponent, DatasetComponent, GridComponent, MarkLineComponent } from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';
import type { EChartsOption } from 'echarts';
import styles from './Chart.module.css';

echarts.use([BarChart, LineChart, AriaComponent, DatasetComponent, GridComponent, MarkLineComponent, SVGRenderer]);

export function Chart({ option }: { option: EChartsOption }) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const chart = echarts.init(container.current!, undefined, { renderer: 'svg' });
    chart.setOption(option);
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(container.current!);
    return () => {
      observer.disconnect();
      chart.dispose();
    };
  }, [option]);
  return <div ref={container} className={styles.chart} />;
}
