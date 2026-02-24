/**
 * Prisma seed — populates HistoricalReturn with approximate annual total returns
 * for TSX Composite (Canadian equities) and FTSE Canada Bond Universe (1970-2024).
 * Sources: Bank of Canada, Morningstar Canada, FTSE Russell historical data.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TSX_RETURNS: Record<number, number> = {
  1970: 0.03,  1971: 0.10,  1972: 0.27,  1973: -0.04, 1974: -0.27,
  1975: 0.18,  1976: 0.12,  1977: 0.10,  1978: 0.28,  1979: 0.43,
  1980: 0.30,  1981: -0.11, 1982: 0.05,  1983: 0.36,  1984: 0.00,
  1985: 0.25,  1986: 0.09,  1987: 0.05,  1988: 0.11,  1989: 0.21,
  1990: -0.15, 1991: 0.12,  1992: -0.02, 1993: 0.33,  1994: -0.04,
  1995: 0.14,  1996: 0.28,  1997: 0.15,  1998: -0.17, 1999: 0.31,
  2000: 0.07,  2001: -0.22, 2002: -0.14, 2003: 0.27,  2004: 0.14,
  2005: 0.24,  2006: 0.17,  2007: 0.10,  2008: -0.35, 2009: 0.36,
  2010: 0.17,  2011: -0.11, 2012: 0.07,  2013: 0.13,  2014: 0.11,
  2015: -0.11, 2016: 0.21,  2017: 0.09,  2018: -0.12, 2019: 0.23,
  2020: 0.05,  2021: 0.22,  2022: -0.06, 2023: 0.12,  2024: 0.18,
};

const CA_BOND_RETURNS: Record<number, number> = {
  1970: 0.07,  1971: 0.06,  1972: 0.07,  1973: 0.04,  1974: -0.04,
  1975: 0.08,  1976: 0.20,  1977: 0.10,  1978: 0.06,  1979: 0.01,
  1980: 0.02,  1981: -0.01, 1982: 0.34,  1983: 0.09,  1984: 0.16,
  1985: 0.21,  1986: 0.15,  1987: 0.02,  1988: 0.11,  1989: 0.13,
  1990: 0.07,  1991: 0.22,  1992: 0.12,  1993: 0.18,  1994: -0.07,
  1995: 0.20,  1996: 0.12,  1997: 0.10,  1998: 0.09,  1999: -0.01,
  2000: 0.10,  2001: 0.08,  2002: 0.09,  2003: 0.06,  2004: 0.07,
  2005: 0.07,  2006: 0.04,  2007: 0.03,  2008: 0.06,  2009: 0.06,
  2010: 0.07,  2011: 0.10,  2012: 0.05,  2013: -0.01, 2014: 0.09,
  2015: 0.03,  2016: 0.01,  2017: 0.02,  2018: 0.01,  2019: 0.07,
  2020: 0.09,  2021: -0.03, 2022: -0.12, 2023: 0.07,  2024: 0.04,
};

async function main() {
  console.log('Seeding historical returns…');

  // Clear existing
  await prisma.historicalReturn.deleteMany({});

  const rows = [
    ...Object.entries(TSX_RETURNS).map(([year, returnRate]) => ({
      year: parseInt(year),
      asset: 'TSX',
      returnRate,
    })),
    ...Object.entries(CA_BOND_RETURNS).map(([year, returnRate]) => ({
      year: parseInt(year),
      asset: 'CA_BOND',
      returnRate,
    })),
  ];

  await prisma.historicalReturn.createMany({ data: rows });
  console.log(`Seeded ${rows.length} historical return rows (${Object.keys(TSX_RETURNS).length} TSX + ${Object.keys(CA_BOND_RETURNS).length} CA_BOND).`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
