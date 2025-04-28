import { VegaLiteSpec } from 'vega-lite';

export async function genVegaSpec(headers: string[], data: any[]): Promise<VegaLiteSpec> {
  // Basic error handling
  if (!headers || headers.length < 2 || !data || data.length === 0) {
    throw new Error("Insufficient data or headers to generate visualization.");
  }

  const xField = headers[0]; // First column for X-axis
  const yField = headers[1]; // Second column for Y-axis

  // Check if the chosen fields exist in the data
  if (!data[0].hasOwnProperty(xField) || !data[0].hasOwnProperty(yField)) {
    throw new Error(`Selected fields "${xField}" or "${yField}" do not exist in the data.`);
  }

  const spec: VegaLiteSpec = {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    description: 'A simple scatter plot generated from CSV data.',
    data: {
      values: data
    },
    mark: 'point',
    encoding: {
      x: { field: xField, type: 'quantitative' },
      y: { field: yField, type: 'quantitative' },
      tooltip: headers // Show all headers in tooltip
    }
  };
  return spec;
}
