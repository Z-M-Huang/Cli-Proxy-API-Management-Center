import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js';

let usageChartsRegistered = false;

export function ensureUsageChartsRegistered(): void {
  if (usageChartsRegistered) {
    return;
  }

  ChartJS.register(
    BarElement,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
  );
  usageChartsRegistered = true;
}
