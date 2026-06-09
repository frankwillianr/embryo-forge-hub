import {
  Calculator,
  CheckSquare,
  CircleDollarSign,
  CircleMinus,
  CirclePlus,
  Eye,
  Grid3X3,
  Headphones,
  HelpCircle,
  Home,
  List,
  PanelTop,
  ReceiptText,
  Scale,
  ShieldCheck,
  Shuffle,
  type LucideIcon,
} from "lucide-react";

const moneyCards = [
  { value: "R$ 0,00", label: "Recebimentos hoje", tone: "blue" },
  { value: "R$ 0,00", label: "Pagamentos hoje", tone: "blue" },
  { value: "R$ 3.489,00", label: "Recebimentos atraso", tone: "red", action: true },
  { value: "R$ 43.150,00", label: "Pagamentos em atraso", tone: "red", action: true },
];

const balances = [
  ["R$ 17.580,67", "Inter"],
  ["R$ 500,00", "Dinheiro"],
  ["R$ 13.000,00", "Inter Investimentos"],
  ["-R$ 800,00", "Sicred"],
  ["R$ 51.953,31", "Bancob"],
];

const summaryCards = [
  { value: "1", label: "Qtd. Entrada (Janeiro)", tone: "blue" },
  { value: "R$ 843,00", label: "Total de entrada (Janeiro)", tone: "blue" },
  { value: "1", label: "Qtd Saida (Janeiro)", tone: "red" },
  { value: "R$ 843,00", label: "Total de saida (Janeiro)", tone: "red" },
];

const navItems = [
  { label: "Espelho", icon: Home, active: true },
  { label: "Recebimentos", icon: CirclePlus },
  { label: "Pagamentos", icon: CircleMinus },
  { label: "Contatos", icon: Headphones },
  { label: "Suporte", icon: HelpCircle },
  { label: "Ponto de equilibrio", icon: Scale },
  { label: "Painel admin", icon: List },
];

const chartGroups = [
  { in: 843, out: 843, inLabel: "R$ 843,00", outLabel: "R$ 843,00" },
  { in: 0, out: 0, inLabel: "R$ 0,00", outLabel: "R$ 0,00" },
  { in: 833, out: 6203, inLabel: "R$ 833,31", outLabel: "R$ 6.203,66" },
  { in: 0, out: 0, inLabel: "R$ 0,00", outLabel: "R$ 0,00" },
  { in: 0, out: 0, inLabel: "R$ 0,00", outLabel: "R$ 0,00" },
  { in: 0, out: 0, inLabel: "R$ 0,00", outLabel: "R$ 0,00" },
  { in: 0, out: 0, inLabel: "R$ 0,00", outLabel: "R$ 0,00" },
  { in: 0, out: 0, inLabel: "R$ 0,00", outLabel: "R$ 0,00" },
  { in: 0, out: 0, inLabel: "R$ 0,00", outLabel: "R$ 0,00" },
  { in: 60000, out: 66300, inLabel: "R$ 60.000,00", outLabel: "R$ 66.300,00" },
];

const maxChartValue = 70000;

const TesteOficinaPage = () => {
  return (
    <div className="min-h-screen overflow-x-auto bg-[#eeeeef] text-[#020817]">
      <div className="flex min-w-[1440px]">
        <aside className="fixed left-0 top-0 z-20 h-screen w-[198px] border-r border-[#e1e1e1] bg-white px-2.5 py-2.5">
          <div className="mb-7 flex h-[86px] flex-col items-center justify-center rounded-lg bg-white">
            <div className="relative mb-1 h-9 w-9">
              <div className="absolute left-1/2 top-0 h-7 w-5 -translate-x-1/2 rounded-full border-[3px] border-black bg-white" />
              <div className="absolute left-2 top-5 h-3 w-3 rounded-full bg-black" />
              <div className="absolute right-2 top-5 h-3 w-3 rounded-full bg-black" />
              <div className="absolute bottom-0 left-1/2 h-3 w-5 -translate-x-1/2 rounded-b-full border-[3px] border-t-0 border-black" />
            </div>
            <div className="text-[19px] font-light leading-none tracking-wide">
              OFC<span className="font-extrabold">ORG</span>
            </div>
          </div>

          <nav className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  className={`flex h-[39px] w-full items-center gap-2 rounded-lg border px-3 text-left text-[13px] transition ${
                    item.active
                      ? "border-[#07154d] bg-[#07154d] font-semibold text-white"
                      : "border-[#dddddd] bg-white text-[#444]"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="ml-[198px] min-h-screen flex-1 pb-6">
          <header className="sticky top-0 z-10 flex h-[76px] items-center gap-3 bg-[#f1f1f2] px-6">
            <div className="ml-[143px] flex flex-1 items-center gap-3">
              <TopButton icon={Calculator} label="Calculadora" />
              <TopButton icon={Grid3X3} label="Painel" />
              <TopButton icon={Shuffle} label="Transferir" />
              <TopButton icon={CheckSquare} label="Acerto de caixa" />
              <TopButton icon={CircleMinus} label="Nova saida" gold />
              <TopButton icon={CirclePlus} label="Nova entrada" />
              <div className="flex h-[39px] items-center gap-2 rounded-lg bg-[#ffedbf] px-4 text-[13px] text-[#171717]">
                <ReceiptText className="h-4 w-4" />
                <div className="leading-tight">
                  <div>Minha assinatura</div>
                  <div className="text-[12px] font-semibold">Ativo ate o dia 01/01/2028</div>
                </div>
              </div>
              <button className="flex h-[39px] min-w-[203px] items-center justify-center gap-2 rounded-lg border border-[#d9d9d9] bg-white px-4 text-[11px] font-bold text-[#1f2937]">
                <PanelTop className="h-3.5 w-3.5 text-[#9aa3b5]" />
                PAINEL ADMINISTRATIVO TESTE
              </button>
            </div>
          </header>

          <section className="px-6">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h1 className="text-[21px] font-bold leading-none">Dashboard</h1>
                <p className="text-[13px] leading-tight text-black">Dashboard</p>
              </div>
              <ShieldCheck className="mt-3 h-5 w-5 rotate-12 text-[#b7b7b7]" />
            </div>

            <div className="grid grid-cols-4 gap-2.5">
              {moneyCards.map((card) => (
                <div key={card.label} className="relative h-[103px] rounded-lg border border-[#d8d8d8] bg-white px-5 py-6">
                  {card.action && (
                    <button className="absolute right-4 top-5 rounded border border-[#bfc3ca] px-2 py-1 text-[12px] leading-none">
                      Ver extrato
                    </button>
                  )}
                  <div className={`text-[24px] font-medium leading-none ${card.tone === "red" ? "text-red-600" : "text-[#07154d]"}`}>
                    {card.value}
                  </div>
                  <div className="mt-4 text-[13px] text-[#8a8f98]">{card.label}</div>
                </div>
              ))}
            </div>

            <div className="mt-2.5 rounded-lg border border-[#d8d8d8] bg-white px-5 py-5">
              <div className="mb-8 flex items-start justify-between">
                <div className="flex items-center gap-3 text-[14px] font-medium">
                  <HelpCircle className="h-4 w-4 fill-[#07154d] text-white" />
                  Saldos e Extratos
                </div>
                <div className="flex gap-2">
                  <select className="h-10 w-[136px] rounded-lg border border-[#d5d5d5] bg-white px-3 text-[13px]">
                    <option>Janeiro</option>
                  </select>
                  <select className="h-10 w-[72px] rounded-lg border border-[#d5d5d5] bg-white px-2 text-[13px]">
                    <option>2025</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2.5">
                {balances.map(([value, label]) => (
                  <div key={label} className="flex h-[57px] w-[156px] items-center justify-between rounded-lg border border-[#d8d8d8] bg-white px-6">
                    <div className="text-center">
                      <div className="text-[13px] font-medium">{value}</div>
                      <div className="mt-2 text-[13px]">{label}</div>
                    </div>
                    <button className="ml-3 flex h-7 w-7 items-center justify-center rounded-lg border border-[#d8d8d8]">
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-2.5 rounded-lg border border-[#d8d8d8] bg-white px-[18px] py-2.5">
              <div className="grid grid-cols-4 gap-[18px]">
                {summaryCards.map((card) => (
                  <div key={card.label} className="h-[78px] rounded-lg border border-[#d8d8d8] bg-white px-[18px] py-4">
                    <div className={`text-[24px] font-medium leading-none ${card.tone === "red" ? "text-red-600" : "text-[#07154d]"}`}>
                      {card.value}
                    </div>
                    <div className="mt-2 text-[13px] text-[#7b8190]">{card.label}</div>
                  </div>
                ))}
              </div>

              <div className="mt-6">
                <h2 className="text-[21px] font-bold leading-none">Entrada x Saidas</h2>
                <p className="text-[13px] font-medium leading-tight">Atividades OPERACIONAIS</p>
              </div>

              <div className="mt-7 flex gap-2">
                <button className="h-7 rounded-md bg-[#07154d] px-3 text-[11px] font-bold text-white">Barras</button>
                <button className="h-7 rounded-md border border-[#d8dfe9] px-3 text-[11px] text-[#52637a]">Linhas</button>
                <button className="h-7 rounded-md border border-[#d8dfe9] px-3 text-[11px] text-[#52637a]">Area</button>
                <button className="h-7 rounded-md border border-[#d8dfe9] px-3 text-[11px] text-[#52637a]">Misto</button>
                <button className="h-7 rounded-md bg-[#121d39] px-3 text-[11px] font-bold text-white">Ocultar valores</button>
              </div>

              <div className="mt-9 h-[304px] overflow-hidden">
                <div className="relative h-full border-b border-[#d5d9df] pl-[62px] pr-3">
                  <div className="absolute inset-x-0 top-0 ml-[62px] mr-3 h-px bg-[#eef0f3]" />
                  {[0, 1, 2, 3, 4, 5, 6].map((line) => (
                    <div
                      key={line}
                      className="absolute left-[62px] right-3 h-px bg-[#eef0f3]"
                      style={{ bottom: `${(line / 6) * 274}px` }}
                    />
                  ))}
                  {["R$ 0,00", "R$ 10.000,00", "R$ 20.000,00", "R$ 30.000,00", "R$ 40.000,00", "R$ 50.000,00", "R$ 60.000,00", "R$ 70.000,00"].map(
                    (label, index) => (
                      <div
                        key={label}
                        className="absolute left-0 text-[8px] text-[#92a3bf]"
                        style={{ bottom: `${(index / 7) * 274 - 4}px` }}
                      >
                        {label}
                      </div>
                    ),
                  )}

                  <div className="grid h-full grid-cols-10">
                    {chartGroups.map((group, index) => {
                      const inHeight = Math.max((group.in / maxChartValue) * 274, group.in > 0 ? 3 : 2);
                      const outHeight = Math.max((group.out / maxChartValue) * 274, group.out > 0 ? 3 : 2);

                      return (
                        <div key={index} className="relative border-l border-[#eef0f3]">
                          <div className="absolute bottom-0 left-1/2 flex -translate-x-1/2 items-end gap-1">
                            <div className="relative w-[42px]">
                              <span className="absolute -top-4 left-1/2 w-20 -translate-x-1/2 text-center text-[10px] font-bold text-[#303846]">
                                {group.inLabel}
                              </span>
                              <div className="rounded-t-sm bg-[#07154d]" style={{ height: inHeight }} />
                            </div>
                            <div className="relative w-[42px]">
                              <span className="absolute -top-4 left-1/2 w-20 -translate-x-1/2 text-center text-[10px] font-bold text-[#303846]">
                                {group.outLabel}
                              </span>
                              <div className="rounded-t-sm bg-[#e2a008]" style={{ height: outHeight }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

const TopButton = ({
  icon: Icon,
  label,
  gold = false,
}: {
  icon: LucideIcon;
  label: string;
  gold?: boolean;
}) => (
  <button
    className={`flex h-[38px] min-w-[178px] items-center gap-2 rounded-lg px-3 text-[13px] font-bold text-white ${
      gold ? "bg-[#e4a006]" : "bg-[#07154d]"
    }`}
  >
    <Icon className="h-3.5 w-3.5" />
    {label}
  </button>
);

export default TesteOficinaPage;
