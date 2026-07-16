interface Props {
  label: string;
  value: string;
  color?: string;
}

export default function StatCard({ label, value, color = '#12192b' }: Props) {
  return (
    <div
      className="bg-white"
      style={{ border: '1px solid #dfd8c8', borderRadius: 12, padding: '20px 22px' }}
    >
      <p style={{ fontSize: 12.5, color: '#5b5f6b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>
        {label}
      </p>
      <p className="mt-2 font-bold" style={{ fontSize: 26, color }}>
        {value}
      </p>
    </div>
  );
}
