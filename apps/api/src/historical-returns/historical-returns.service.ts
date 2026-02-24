import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HistoricalReturnsService {
  constructor(private prisma: PrismaService) {}

  async findAll(asset?: string, from?: number, to?: number) {
    return this.prisma.historicalReturn.findMany({
      where: {
        ...(asset ? { asset } : {}),
        ...(from != null || to != null ? {
          year: {
            ...(from != null ? { gte: from } : {}),
            ...(to != null ? { lte: to } : {}),
          },
        } : {}),
      },
      orderBy: [{ asset: 'asc' }, { year: 'asc' }],
    });
  }

  async summary(asset?: string) {
    const rows = await this.findAll(asset);
    if (!rows.length) return null;
    const rates = rows.map((r) => r.returnRate);
    const mean = rates.reduce((s, r) => s + r, 0) / rates.length;
    const variance = rates.reduce((s, r) => s + (r - mean) ** 2, 0) / rates.length;
    const stdDev = Math.sqrt(variance);
    const sorted = [...rates].sort((a, b) => a - b);
    return {
      asset: asset ?? 'ALL',
      count: rates.length,
      mean: parseFloat(mean.toFixed(4)),
      stdDev: parseFloat(stdDev.toFixed(4)),
      min: sorted[0],
      max: sorted[sorted.length - 1],
      median: sorted[Math.floor(sorted.length / 2)],
    };
  }

  async seed() {
    // TSX total return (annual), sourced from public data 1970-2024
    const tsxData: [number, number][] = [
      [1970, -0.0314], [1971, 0.0802], [1972, 0.2708], [1973, -0.0025], [1974, -0.2570],
      [1975, 0.1814], [1976, 0.1169], [1977, 0.1023], [1978, 0.2912], [1979, 0.4447],
      [1980, 0.2997], [1981, -0.1066], [1982, 0.0573], [1983, 0.3560], [1984, -0.0253],
      [1985, 0.2552], [1986, 0.0862], [1987, 0.0522], [1988, 0.1160], [1989, 0.2124],
      [1990, -0.1472], [1991, 0.1242], [1992, -0.0166], [1993, 0.3283], [1994, -0.0018],
      [1995, 0.1456], [1996, 0.2821], [1997, 0.1478], [1998, -0.0174], [1999, 0.3164],
      [2000, 0.0666], [2001, -0.1297], [2002, -0.1202], [2003, 0.2669], [2004, 0.1473],
      [2005, 0.2450], [2006, 0.1733], [2007, 0.0966], [2008, -0.3306], [2009, 0.3551],
      [2010, 0.1772], [2011, -0.0888], [2012, 0.0720], [2013, 0.1295], [2014, 0.1098],
      [2015, -0.0824], [2016, 0.2150], [2017, 0.0988], [2018, -0.0884], [2019, 0.2270],
      [2020, 0.0551], [2021, 0.2180], [2022, -0.0552], [2023, 0.1180], [2024, 0.1820],
    ];

    // Canadian bonds (FTSE TMX universe bond index) 1970-2024
    const caBondData: [number, number][] = [
      [1970, 0.0628], [1971, 0.0921], [1972, 0.0745], [1973, 0.0254], [1974, -0.0470],
      [1975, 0.0800], [1976, 0.1934], [1977, 0.1014], [1978, 0.0494], [1979, -0.0229],
      [1980, 0.0220], [1981, -0.0195], [1982, 0.3450], [1983, 0.0925], [1984, 0.1626],
      [1985, 0.2611], [1986, 0.1652], [1987, 0.0295], [1988, 0.1238], [1989, 0.1433],
      [1990, 0.0741], [1991, 0.2249], [1992, 0.1015], [1993, 0.1869], [1994, -0.0456],
      [1995, 0.2032], [1996, 0.1233], [1997, 0.0946], [1998, 0.0944], [1999, -0.0165],
      [2000, 0.1065], [2001, 0.0815], [2002, 0.0881], [2003, 0.0700], [2004, 0.0700],
      [2005, 0.0672], [2006, 0.0427], [2007, 0.0385], [2008, 0.0641], [2009, 0.0556],
      [2010, 0.0663], [2011, 0.0966], [2012, 0.0368], [2013, -0.0127], [2014, 0.0885],
      [2015, 0.0351], [2016, 0.0143], [2017, 0.0254], [2018, 0.0136], [2019, 0.0676],
      [2020, 0.0865], [2021, -0.0247], [2022, -0.1168], [2023, 0.0666], [2024, 0.0350],
    ];

    // Canadian GIC average rate 1970-2024
    const gicData: [number, number][] = [
      [1970, 0.0750], [1971, 0.0650], [1972, 0.0650], [1973, 0.0775], [1974, 0.1000],
      [1975, 0.0975], [1976, 0.1025], [1977, 0.0850], [1978, 0.0975], [1979, 0.1250],
      [1980, 0.1450], [1981, 0.1875], [1982, 0.1725], [1983, 0.1200], [1984, 0.1300],
      [1985, 0.1175], [1986, 0.1050], [1987, 0.1025], [1988, 0.1125], [1989, 0.1200],
      [1990, 0.1275], [1991, 0.1025], [1992, 0.0825], [1993, 0.0650], [1994, 0.0700],
      [1995, 0.0775], [1996, 0.0625], [1997, 0.0475], [1998, 0.0500], [1999, 0.0475],
      [2000, 0.0575], [2001, 0.0500], [2002, 0.0400], [2003, 0.0325], [2004, 0.0325],
      [2005, 0.0350], [2006, 0.0425], [2007, 0.0475], [2008, 0.0425], [2009, 0.0250],
      [2010, 0.0225], [2011, 0.0225], [2012, 0.0200], [2013, 0.0200], [2014, 0.0200],
      [2015, 0.0175], [2016, 0.0150], [2017, 0.0175], [2018, 0.0275], [2019, 0.0275],
      [2020, 0.0175], [2021, 0.0175], [2022, 0.0375], [2023, 0.0500], [2024, 0.0475],
    ];

    const entries = [
      ...tsxData.map(([year, returnRate]) => ({ year, asset: 'TSX', returnRate })),
      ...caBondData.map(([year, returnRate]) => ({ year, asset: 'CA_BOND', returnRate })),
      ...gicData.map(([year, returnRate]) => ({ year, asset: 'GIC', returnRate })),
    ];

    // Upsert using deleteMany + createMany for simplicity
    await this.prisma.historicalReturn.deleteMany({
      where: { asset: { in: ['TSX', 'CA_BOND', 'GIC'] } },
    });
    await this.prisma.historicalReturn.createMany({ data: entries });
    return { seeded: entries.length };
  }
}
