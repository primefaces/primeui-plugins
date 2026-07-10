export const expectedMcpTools = [
  'get_component',
  'get_example',
  'get_guide',
  'get_setup',
  'list',
  'search',
  'validate_usage',
  'version'
];

export const libraryNames = ['primevue', 'primeng', 'primereact'];

export const usageContracts = {
  primeng: {
    validCode: '<p-button label="Save" severity="success" [disabled]="saving" />',
    invalidCode: '<p-button label="Save" [madeUp]="true" />'
  },
  primereact: {
    validCode: [
      "import { Button } from 'primereact/button';",
      '',
      'export function SaveAction() {',
      '  return <Button severity="success">Save</Button>;',
      '}'
    ].join('\n'),
    invalidCode: '<Button severity="success" madeUp>Save</Button>'
  },
  primevue: {
    validCode: '<Button label="Save" severity="success" :disabled="saving" />',
    invalidCode: '<Button label="Save" madeUp />'
  }
};
