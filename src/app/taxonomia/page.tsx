import { PARENT_TO_LEAVES } from '@/app/a/lib/categories'
import { VALID_DISH_TYPES, VALID_CUISINES, VALID_MEAL_SLOTS, VALID_FLAVORS } from '@/lib/taxonomy-classify'

const DISH_TYPE_GROUPS: { label: string; values: string[] }[] = [
  { label: 'Especiales',          values: ['combo', 'extra'] },
  { label: 'Sándwiches y panes',  values: ['hamburguesa', 'completo', 'sándwich', 'wrap', 'croissant', 'bagel', 'tostada'] },
  { label: 'Sándwiches chilenos', values: ['churrasco', 'mechada', 'as'] },
  { label: 'Carnes',              values: ['milanesa', 'asado', 'costillas', 'pernil', 'anticucho', 'kebab', 'satay'] },
  { label: 'Pollo',               values: ['pollo asado', 'pollo frito', 'tenders', 'alitas', 'nuggets'] },
  { label: 'Mariscos',            values: ['ceviche', 'tiradito'] },
  { label: 'Pastas y arroces',    values: ['pasta', 'lasagna', 'risotto', 'arroz', 'fideos'] },
  { label: 'Pizza y masas',       values: ['pizza', 'calzone', 'quiche', 'empanada'] },
  { label: 'Sopas',               values: ['sopa', 'cazuela', 'chupe', 'ramen'] },
  { label: 'Ensaladas y bowls',   values: ['ensalada', 'bowl'] },
  { label: 'Asiática',            values: ['sushi', 'hand roll', 'sushiburger', 'kimbap', 'bao', 'curry', 'pad thai', 'gyoza', 'dumpling', 'mandu', 'wantan'] },
  { label: 'Peruana',             values: ['causa', 'lomo saltado', 'ají de gallina', 'arroz con leche'] },
  { label: 'Mexicana / Venezolana', values: ['taco', 'burrito', 'quesadilla', 'arepa', 'salchipapa'] },
  { label: 'China-chilena',       values: ['chapsui'] },
  { label: 'Chilena',             values: ['sopaipilla', 'pastel de choclo', 'pastel de jaiba', 'chorrillana', 'lomo a lo pobre'] },
  { label: 'Desayunos',           values: ['huevos', 'pancake', 'waffle', 'crepe', 'avena', 'omelet'] },
  { label: 'Snacks y entradas',   values: ['papas fritas', 'nachos', 'aros de cebolla', 'croquetas', 'arrollado de primavera', 'spring roll'] },
  { label: 'Postres',             values: ['helado', 'torta', 'brownie', 'galleta', 'muffin', 'cheesecake', 'churros', 'donut', 'flan'] },
  { label: 'Bebidas',             values: ['café', 'latte', 'cappuccino', 'mocaccino', 'chocolate caliente', 'té', 'jugo', 'batido', 'bebida', 'alcohol', 'mocktail'] },
]

function Chip({ label }: { label: string }) {
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 20,
      background: 'rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.1)',
      fontSize: 13, fontFamily: 'monospace', margin: '3px 3px',
    }}>
      {label}
    </span>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: '#111', borderBottom: '2px solid #f4a623', paddingBottom: 6, display: 'inline-block' }}>
        {title}
      </h2>
      {children}
    </div>
  )
}

function GroupBlock({ label, values }: { label: string; values: string[] }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
        {label}
      </div>
      <div>
        {values.map(v => <Chip key={v} label={v} />)}
      </div>
    </div>
  )
}

export default function TaxonomiaPage() {
  const parents = Object.entries(PARENT_TO_LEAVES)

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '40px 24px 80px', fontFamily: 'system-ui, sans-serif', color: '#222' }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>Taxonomía de platos</h1>
      <p style={{ fontSize: 14, color: '#888', marginBottom: 40 }}>
        Referencia completa de las categorías y tipos de plato usados en QuieroComer.
      </p>

      {/* CATEGORIAS */}
      <Section title="categoriaParent → categoriaNorm (leaves)">
        <p style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>
          Jerarquía de categorías del feed. <code style={{ background: '#f5f5f5', padding: '1px 5px', borderRadius: 4 }}>categoriaParent</code> es el filtro del feed,{' '}
          <code style={{ background: '#f5f5f5', padding: '1px 5px', borderRadius: 4 }}>categoriaNorm</code> es el leaf asignado a cada plato.
        </p>
        <div style={{ border: '1px solid #eee', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#fafafa', borderBottom: '1px solid #eee' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700, width: '30%' }}>categoriaParent</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700 }}>categoriaNorm (leaves)</th>
              </tr>
            </thead>
            <tbody>
              {parents.map(([parent, leaves], i) => (
                <tr key={parent} style={{ borderBottom: i < parents.length - 1 ? '1px solid #f0f0f0' : 'none', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{ padding: '10px 16px', fontWeight: 700, color: '#f4a623', fontFamily: 'monospace' }}>{parent}</td>
                  <td style={{ padding: '10px 16px' }}>
                    {leaves.map(l => <Chip key={l} label={l} />)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* TXDISHTYPE */}
      <Section title="txDishType">
        <p style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>
          Tipos de plato asignados por el clasificador AI. Un plato puede tener más de uno (ej: combo + hamburguesa).
          Total: <strong>{VALID_DISH_TYPES.length}</strong> valores.
        </p>
        {DISH_TYPE_GROUPS.map(g => (
          <GroupBlock key={g.label} label={g.label} values={g.values} />
        ))}
      </Section>

      {/* AUXILIARES */}
      <Section title="Otros campos AI">
        <GroupBlock label="cuisine" values={VALID_CUISINES} />
        <GroupBlock label="mealSlot" values={VALID_MEAL_SLOTS} />
        <GroupBlock label="flavor" values={VALID_FLAVORS} />
      </Section>
    </div>
  )
}
