const fs = require('fs');

function fixFile(file) {
  let code = fs.readFileSync(file, 'utf8');
  code = code.replace(/revalidatePath\(\`\/events\/\$\{event_slug\}\`, "layout"\);/g, 'revalidatePath(`/events/${event_slug}`);');
  code = code.replace(/revalidatePath\(\`\/events\`, "page"\);/g, 'revalidatePath(`/events`);');
  code = code.replace(/revalidatePath\(\`\/events\`, "layout"\);/g, 'revalidatePath(`/events`);');
  fs.writeFileSync(file, code);
}

fixFile('src/app/api/admin/photos/route.ts');
fixFile('src/app/api/admin/import-from-drive/route.ts');
