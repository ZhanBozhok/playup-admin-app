export default function DashboardPage() {
  return (
    <div>
      <h1 style={{ fontSize: 28, margin: "0 0 8px" }}>Главная</h1>
      <p style={{ color: "var(--color-graphite-600)", maxWidth: 560, lineHeight: 1.6 }}>
        Каркас админки готов (Итерация 0). Ближайшие события, статусы риска, действия и метрики недели
        появятся в Итерации 6 — управленческая Главная.
      </p>
      <div style={card}>
        <div style={{ fontFamily: "var(--font-heading)", fontSize: 20 }}>Что дальше</div>
        <ul style={{ color: "var(--color-graphite-600)", lineHeight: 1.8, marginTop: 8 }}>
          <li>Итерация 1 — события и расписание</li>
          <li>Итерация 2 — запись на событие</li>
          <li>Итерация 3 — профиль и пользователи</li>
        </ul>
      </div>
    </div>
  );
}

const card: React.CSSProperties = {
  marginTop: 24,
  background: "#fff",
  borderRadius: "var(--radius-lg)",
  boxShadow: "var(--shadow-card)",
  padding: 24,
  maxWidth: 560,
};
