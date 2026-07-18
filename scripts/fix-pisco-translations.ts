import { config } from 'dotenv';
config({ path: '.env.local' });

import { translateDish } from '../src/lib/ai/translateContent';

const DISH_IDS = [
  'cmqtqhyge007bjp045ayqfc72','cmqtqhxvz004ljp04potj9ocy','cmqtqhxx7004rjp04sb9vth2o',
  'cmqtqhxxm004tjp04gnaacs9h','cmqtqhxy1004vjp04q04f75ez','cmqtqhy730063jp04vb8cj5tq',
  'cmqtqhy7j0065jp040drpdjdj','cmqtqhy7y0067jp043kv0gbmi','cmqtqhyhh007fjp04pmjbpu8n',
  'cmqtqhxyh004xjp04ycs8538w','cmqtqhy3f005ljp04a3ok5lbv'
];

async function main() {
  console.log('Translating', DISH_IDS.length, 'dishes of Entre Pisco y Pebre...');
  for (const id of DISH_IDS) {
    try {
      await translateDish(id);
      process.stdout.write('.');
    } catch(e: any) {
      process.stdout.write('E');
      console.error('\n', id, e.message);
    }
  }
  console.log('\nDone');
  process.exit(0);
}

main();
