import { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { sankey as d3Sankey, sankeyLinkHorizontal } from 'd3-sankey';
import type { SankeyNode, SankeyLink } from 'd3-sankey';

export interface SankeyProjectionYear {
  year: number;
  age: number;
  totalIncome: number;
  employmentIncome?: number;
  expenses?: number;
  totalTax?: number;
  netCashFlow: number;
  rrspBalance?: number;
  tfsaBalance?: number;
  nonRegBalance?: number;
  rrspContributionYear?: number;
  tfsaContributionYear?: number;
  surplusToNonReg?: number;
  /** Surplus that went to the cash/savings bucket instead of non-reg */
  surplusToCash?: number;
  unusedRrspRoom?: number;
  unusedTfsaRoom?: number;
}

interface SankeyChartProps {
  data: SankeyProjectionYear[];
}

interface NodeDatum { name: string; }
type SNode = SankeyNode<NodeDatum, object>;
type SLink = SankeyLink<NodeDatum, object>;

function buildSankeyData(avgYear: SankeyProjectionYear) {
  const income = Math.abs(avgYear.totalIncome);
  const tax = Math.abs(avgYear.totalTax ?? 0);
  const livingExpenses = Math.abs(avgYear.expenses ?? 0);
  const rrspContrib = Math.abs(avgYear.rrspContributionYear ?? 0);
  const tfsaContrib = Math.abs(avgYear.tfsaContributionYear ?? 0);
  const surplusNonReg = Math.max(0, avgYear.surplusToNonReg ?? 0);
  const surplusCash   = Math.max(0, avgYear.surplusToCash   ?? 0);
  // Fall back to netCashFlow only when both surplus fields are absent (legacy data)
  const legacySurplus = (avgYear.surplusToNonReg == null && avgYear.surplusToCash == null)
    ? Math.max(0, avgYear.netCashFlow) : 0;

  const nodes: NodeDatum[] = [
    { name: 'Total Income' },    // 0
    { name: 'Tax' },             // 1
    { name: 'Living Expenses' }, // 2
    { name: 'RRSP' },            // 3
    { name: 'TFSA' },            // 4
    { name: 'NonReg Invest.' },  // 5
    { name: 'Savings Acct' },    // 6
  ];

  const links: Array<{ source: number; target: number; value: number }> = [];
  if (tax > 0)                    links.push({ source: 0, target: 1, value: tax });
  if (livingExpenses > 0)         links.push({ source: 0, target: 2, value: Math.max(1, livingExpenses) });
  if (rrspContrib > 0)            links.push({ source: 0, target: 3, value: rrspContrib });
  if (tfsaContrib > 0)            links.push({ source: 0, target: 4, value: tfsaContrib });
  if (surplusNonReg + legacySurplus > 0) links.push({ source: 0, target: 5, value: surplusNonReg + legacySurplus });
  if (surplusCash > 0)            links.push({ source: 0, target: 6, value: surplusCash });

  return { nodes, links };
}

/** Pick the midpoint working year (employmentIncome > 0). Falls back to first year. */
function pickRepresentativeYear(data: SankeyProjectionYear[]): SankeyProjectionYear {
  const workingYears = data.filter((d) => (d.employmentIncome ?? 0) > 0);
  const pool = workingYears.length > 0 ? workingYears : data;
  return pool[Math.floor(pool.length / 2)];
}

export function SankeyChart({ data }: SankeyChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;
    const el = svgRef.current;
    let rafId: number;

    const draw = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const containerWidth = el.getBoundingClientRect().width || el.parentElement?.clientWidth || 0;
        if (containerWidth < 10) return;

        d3.select(el).selectAll('*').remove();

        // Use midpoint working year (pre-retirement) as representative
        const midYear = pickRepresentativeYear(data);
        const { nodes, links } = buildSankeyData(midYear);
        if (links.length === 0) return;

        const margin = { top: 10, right: 10, bottom: 10, left: 10 };
        const width = containerWidth - margin.left - margin.right;
        const height = 280 - margin.top - margin.bottom;

        const svg = d3.select(el)
          .append('g')
          .attr('transform', `translate(${margin.left},${margin.top})`);

        const sankeyLayout = d3Sankey<NodeDatum, object>()
          .nodeWidth(20)
          .nodePadding(20)
          .extent([[0, 0], [width, height]]);

        const { nodes: sankeyNodes, links: sankeyLinks } = sankeyLayout({
          nodes: nodes.map((d) => ({ ...d })),
          links: links.map((d) => ({ ...d })),
        });

        const colors = ['#1976d2', '#d32f2f', '#388e3c', '#7B1FA2', '#00BCD4', '#f57c00', '#81D4FA'];

        svg.selectAll<SVGPathElement, SLink>('.link')
          .data(sankeyLinks)
          .join('path')
          .attr('class', 'link')
          .attr('d', sankeyLinkHorizontal())
          .attr('fill', 'none')
          .attr('stroke', (d) => colors[(d.target as SNode).index ?? 0])
          .attr('stroke-width', (d) => Math.max(1, d.width ?? 1))
          .attr('opacity', 0.4);

        svg.selectAll<SVGRectElement, SNode>('.node')
          .data(sankeyNodes)
          .join('rect')
          .attr('class', 'node')
          .attr('x', (d) => d.x0 ?? 0)
          .attr('y', (d) => d.y0 ?? 0)
          .attr('height', (d) => Math.max(1, (d.y1 ?? 0) - (d.y0 ?? 0)))
          .attr('width', (d) => (d.x1 ?? 0) - (d.x0 ?? 0))
          .attr('fill', (d) => colors[d.index ?? 0])
          .attr('rx', 3);

        svg.selectAll<SVGTextElement, SNode>('.label')
          .data(sankeyNodes)
          .join('text')
          .attr('class', 'label')
          .attr('x', (d) => ((d.x0 ?? 0) < width / 2 ? (d.x1 ?? 0) + 6 : (d.x0 ?? 0) - 6))
          .attr('y', (d) => ((d.y1 ?? 0) + (d.y0 ?? 0)) / 2)
          .attr('dy', '0.35em')
          .attr('text-anchor', (d) => (d.x0 ?? 0) < width / 2 ? 'start' : 'end')
          .attr('font-size', 11)
          .attr('fill', 'currentColor')
          .text((d) => {
            const val = (d.value ?? 0);
            const fmtVal = val >= 1000 ? `$${(val / 1000).toFixed(0)}K` : `$${val.toFixed(0)}`;
            return `${d.name} (${fmtVal})`;
          });
      });
    };

    const ro = new ResizeObserver(draw);
    ro.observe(el);
    draw();
    return () => { ro.disconnect(); cancelAnimationFrame(rafId); };
  }, [data]);

  return <svg ref={svgRef} width="100%" height={280} />;
}
