import { supabase } from './src/integrations/external-supabase/client';
import { supabase as lpSupabase } from './src/integrations/lp-supabase/client';

async function updateVersions() {
  console.log('Updating LoveX licenses...');
  const { data: lovexData, error: lovexError } = await supabase
    .from('licenses')
    .update({ max_version: '2.1' })
    .or('max_version.eq.1.9,max_version.eq.1.9.9');

  if (lovexError) {
    console.error('Error updating LoveX licenses:', lovexError);
  } else {
    console.log('LoveX licenses updated successfully.');
  }

  console.log('Updating LovPro licenses...');
  const { data: lpData, error: lpError } = await lpSupabase
    .from('licenses')
    .update({ max_version: '2.1' })
    .or('max_version.eq.1.9,max_version.eq.1.9.9');

  if (lpError) {
    console.error('Error updating LovPro licenses:', lpError);
  } else {
    console.log('LovPro licenses updated successfully.');
  }
}

updateVersions();
