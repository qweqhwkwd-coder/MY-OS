import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { XpPoint } from '../api'

// Окремий файл, щоб recharts потрапляв у lazy-чанк і не роздував основний бандл
export default function XpChart({ data }: { data: XpPoint[] }) {
  return (
    <div style={{ width: '100%', height: 160 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
          <CartesianGrid vertical={false} stroke="var(--subtle)" />
          <XAxis
            dataKey="date"
            tickFormatter={(d: string) => d.slice(8, 10) + '.' + d.slice(5, 7)}
            ticks={[0, 1, 2, 3].map(i => data[Math.round(i * (data.length - 1) / 3)]?.date).filter(Boolean)}
            tick={{ fontSize: 10, fontFamily: 'IBM Plex Mono, monospace', fill: 'var(--muted)' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 10, fontFamily: 'IBM Plex Mono, monospace', fill: 'var(--muted)' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ stroke: 'var(--muted)', strokeWidth: 1 }}
            contentStyle={{
              background: 'var(--bg)',
              border: '1px solid var(--subtle)',
              borderRadius: 0,
              fontFamily: 'IBM Plex Mono, monospace',
              fontSize: 11,
              color: 'var(--ink)',
            }}
            labelStyle={{ color: 'var(--muted)' }}
            formatter={(value) => [`${value} XP`, '']}
            separator=""
          />
          <Line
            type="monotone"
            dataKey="xp"
            stroke="var(--chart-line)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: 'var(--chart-line)', stroke: 'var(--bg)', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
