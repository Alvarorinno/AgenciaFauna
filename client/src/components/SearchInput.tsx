interface Props {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

// Buscador de texto libre para las tablas de Cotizaciones y Eventos/Proyectos:
// se usa junto a los FilterSelect existentes (mismo look) y filtra en el
// cliente contra varios campos de cada fila (ver searchNormalize en utils.ts).
export default function SearchInput({ label = 'Buscar', value, onChange, placeholder }: Props) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', color: '#5b5f6b', fontWeight: 600, marginBottom: 4, letterSpacing: 0.3 }}>
        {label}
      </label>
      <div className="flex items-center" style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 10, color: '#9aa0ad', fontSize: 13, pointerEvents: 'none' }}>⌕</span>
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            padding: '9px 12px 9px 26px',
            border: '1px solid #dfd8c8',
            borderRadius: 7,
            fontSize: 13,
            width: 240,
            color: '#12192b'
          }}
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            title="Limpiar búsqueda"
            style={{ position: 'absolute', right: 8, color: '#9aa0ad', fontSize: 13, lineHeight: 1 }}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
