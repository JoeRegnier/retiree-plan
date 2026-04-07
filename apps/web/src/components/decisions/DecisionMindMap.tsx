import { useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import { Box, CircularProgress, Alert, Paper, useTheme, alpha } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '../../hooks/useApi';
import { CATEGORY_COLORS, STATUS_COLORS } from '../../pages/DecisionJournalPage';

interface DecisionNode {
  id: string;
  title: string;
  status: string;
  category: string;
  decisionDate: string | null;
}

interface DecisionEdge {
  source: string;
  target: string;
  type: 'SUPERSEDES' | 'RELATED_TO';
}

interface GraphResponse {
  nodes: DecisionNode[];
  edges: DecisionEdge[];
}

interface SimNode extends d3.SimulationNodeDatum, DecisionNode {
  x?: number;
  y?: number;
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  type: 'SUPERSEDES' | 'RELATED_TO';
}

interface Props {
  householdId: string;
  onNodeClick: (id: string) => void;
}

const WIDTH = 900;
const HEIGHT = 540;
const MIN_RADIUS = 14;
const MAX_RADIUS = 28;

export function DecisionMindMap({ householdId, onNodeClick }: Props) {
  const { apiFetch } = useApi();
  const svgRef = useRef<SVGSVGElement>(null);
  const theme = useTheme();

  const { data: graph, isLoading, error } = useQuery<GraphResponse>({
    queryKey: ['decision-graph', householdId],
    queryFn: () => apiFetch(`/decision-records/household/${householdId}/graph`),
    enabled: !!householdId,
  });

  const renderGraph = useCallback(() => {
    if (!svgRef.current || !graph) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const { nodes: rawNodes, edges: rawEdges } = graph;

    if (rawNodes.length === 0) return;

    // Count connections per node for radius sizing
    const connectionCount: Record<string, number> = {};
    rawNodes.forEach((n) => { connectionCount[n.id] = 0; });
    rawEdges.forEach((e) => {
      connectionCount[e.source] = (connectionCount[e.source] ?? 0) + 1;
      connectionCount[e.target] = (connectionCount[e.target] ?? 0) + 1;
    });
    const maxConn = Math.max(1, ...Object.values(connectionCount));

    const radiusScale = d3.scaleLinear()
      .domain([0, maxConn])
      .range([MIN_RADIUS, MAX_RADIUS]);

    const nodes: SimNode[] = rawNodes.map((n) => ({ ...n }));
    const nodeById = new Map(nodes.map((n) => [n.id, n]));

    const links: SimLink[] = rawEdges
      .map((e) => ({
        source: nodeById.get(e.source)!,
        target: nodeById.get(e.target)!,
        type: e.type,
      }))
      .filter((l) => l.source && l.target);

    // Zoom container
    const container = svg.append('g');

    svg.call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.3, 3])
        .on('zoom', (event) => container.attr('transform', event.transform)),
    );

    // Arrow markers
    const defs = svg.append('defs');
    (['SUPERSEDES', 'RELATED_TO'] as const).forEach((type) => {
      defs.append('marker')
        .attr('id', `arrow-${type}`)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', MAX_RADIUS + 10)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', type === 'SUPERSEDES' ? '#f57c00' : '#1976d2');
    });

    // Force simulation
    const simulation = d3
      .forceSimulation<SimNode>(nodes)
      .force('link', d3.forceLink<SimNode, SimLink>(links).id((d) => d.id).distance(140))
      .force('charge', d3.forceManyBody().strength(-350))
      .force('center', d3.forceCenter(WIDTH / 2, HEIGHT / 2))
      .force('collision', d3.forceCollide<SimNode>().radius((d) => radiusScale(connectionCount[d.id]) + 12));

    // Edges
    const link = container
      .append('g')
      .selectAll<SVGLineElement, SimLink>('line')
      .data(links)
      .join('line')
      .attr('stroke', (d) => (d.type === 'SUPERSEDES' ? '#f57c00' : '#1976d2'))
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', (d) => (d.type === 'SUPERSEDES' ? '6 3' : null))
      .attr('marker-end', (d) => `url(#arrow-${d.type})`);

    // Nodes group
    const node = container
      .append('g')
      .selectAll<SVGGElement, SimNode>('g')
      .data(nodes)
      .join('g')
      .style('cursor', 'pointer')
      .call(
        d3
          .drag<SVGGElement, SimNode>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          }),
      )
      .on('click', (_, d) => onNodeClick(d.id));

    node
      .append('circle')
      .attr('r', (d) => radiusScale(connectionCount[d.id]))
      .attr('fill', (d) => CATEGORY_COLORS[d.category] ?? '#757575')
      .attr('opacity', (d) => {
        if (d.status === 'PROPOSED') return 0.65;
        if (d.status === 'SUPERSEDED' || d.status === 'DEPRECATED') return 0.3;
        return 1;
      })
      .attr('stroke', theme.palette.background.paper)
      .attr('stroke-width', 2);

    // Label
    node
      .append('text')
      .text((d) => (d.title.length > 20 ? d.title.slice(0, 18) + '…' : d.title))
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => radiusScale(connectionCount[d.id]) + 12)
      .attr('font-size', 10)
      .attr('fill', theme.palette.text.primary)
      .style('pointer-events', 'none')
      .style('user-select', 'none');

    // Tooltip on hover
    const tooltip = d3
      .select('body')
      .append('div')
      .attr('class', 'dr-tooltip')
      .style('position', 'fixed')
      .style('background', theme.palette.background.paper)
      .style('border', `1px solid ${theme.palette.divider}`)
      .style('border-radius', '6px')
      .style('padding', '6px 10px')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('opacity', 0)
      .style('z-index', 9999)
      .style('max-width', '240px');

    node
      .on('mouseenter', (event, d) => {
        tooltip
          .style('opacity', 1)
          .html(`<strong>${d.title}</strong><br/>${d.status} · ${d.category.replace(/_/g, ' ')}`);
      })
      .on('mousemove', (event) => {
        tooltip
          .style('left', `${event.clientX + 12}px`)
          .style('top', `${event.clientY - 8}px`);
      })
      .on('mouseleave', () => tooltip.style('opacity', 0));

    simulation.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as SimNode).x ?? 0)
        .attr('y1', (d) => (d.source as SimNode).y ?? 0)
        .attr('x2', (d) => (d.target as SimNode).x ?? 0)
        .attr('y2', (d) => (d.target as SimNode).y ?? 0);

      node.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    // Cleanup tooltips on unmount
    return () => {
      tooltip.remove();
      simulation.stop();
    };
  }, [graph, theme, onNodeClick]);

  useEffect(() => {
    const cleanup = renderGraph();
    return () => { cleanup?.(); };
  }, [renderGraph]);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">Failed to load mind map data.</Alert>;
  }

  if (!graph || graph.nodes.length === 0) {
    return (
      <Alert severity="info">
        No decisions yet. Create some decisions and link them together to see the mind map.
      </Alert>
    );
  }

  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden', height: HEIGHT }}>
      <svg
        ref={svgRef}
        width="100%"
        height={HEIGHT}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
      />
    </Paper>
  );
}
