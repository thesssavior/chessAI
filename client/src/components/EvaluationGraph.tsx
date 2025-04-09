import React from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface EvaluationPoint {
  moveNumber: number;
  evaluation: number;
  isCritical: boolean;
}

interface EvaluationGraphProps {
  evaluations: EvaluationPoint[];
  onMoveSelect: (index: number) => void;
}

export function EvaluationGraph({ evaluations, onMoveSelect }: EvaluationGraphProps) {
  const data = {
    labels: evaluations.map(e => `Move ${Math.floor(e.moveNumber / 2) + 1}${e.moveNumber % 2 === 0 ? ' (White)' : ' (Black)'}`),
    datasets: [
      {
        label: 'Evaluation',
        data: evaluations.map(e => e.evaluation),
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1,
        pointBackgroundColor: evaluations.map(e => 
          e.isCritical ? 'rgb(255, 99, 132)' : 'rgb(75, 192, 192)'
        ),
        pointRadius: evaluations.map(e => e.isCritical ? 6 : 3),
      }
    ]
  };

  const options = {
    responsive: true,
    onClick: (event: any, elements: any) => {
      if (elements.length > 0) {
        const index = elements[0].index;
        onMoveSelect(evaluations[index].moveNumber);
      }
    },
    scales: {
      y: {
        title: {
          display: true,
          text: 'Evaluation (pawns)'
        },
        min: -5,
        max: 5
      },
      x: {
        title: {
          display: true,
          text: 'Move'
        }
      }
    },
    plugins: {
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const evaluation = context.raw;
            return `Evaluation: ${evaluation > 0 ? '+' : ''}${evaluation.toFixed(2)}`;
          }
        }
      }
    }
  };

  return (
    <div className="w-full h-48 mb-4 bg-white p-2 rounded shadow-sm">
      <Line data={data} options={options} />
    </div>
  );
} 