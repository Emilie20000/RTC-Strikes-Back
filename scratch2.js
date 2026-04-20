const fs = require('fs');

const file = '/home/raiga/preMSC/T-DEV-600-LIL_10/frontend/components/layout/MembersSidebar.tsx';
let content = fs.readFileSync(file, 'utf8');

const replacements = [
  { regex: /bg-\[#2f3136\]/g, replace: 'bg-sidebar' },
  { regex: /border-\[#202225\]/g, replace: 'border-border' },
  { regex: /text-\[#8e9297\]/g, replace: 'text-muted-foreground' },
  { regex: /text-\[#b9bbbe\]/g, replace: 'text-muted-foreground' },
  { regex: /hover:text-\[#dcddde\]/g, replace: 'hover:text-foreground' },
  { regex: /hover:bg-\[#32353b\]/g, replace: 'hover:bg-sidebar-accent' },
  { regex: /bg-\[#5865F2\]/g, replace: 'bg-primary' },
  { regex: /text-white/g, replace: 'text-foreground' },
  { regex: /text-\[#dcddde\]/g, replace: 'text-sidebar-foreground' },
  { regex: /text-\[#FEE75C\]/g, replace: 'text-amber-500' },
  { regex: /text-\[#5865F2\]/g, replace: 'text-primary' },
  { regex: /hover:text-white/g, replace: 'hover:text-foreground' },
  { regex: /bg-\[#18191c\]/g, replace: 'bg-popover' },
  { regex: /focus:bg-\[#5865F2\]/g, replace: 'focus:bg-primary' },
  { regex: /focus:text-white/g, replace: 'focus:text-primary-foreground' },
  { regex: /text-\[#DA373C\]/g, replace: 'text-destructive' },
  { regex: /focus:bg-\[#DA373C\]/g, replace: 'focus:bg-destructive' },
];

replacements.forEach(({ regex, replace }) => {
  content = content.replace(regex, replace);
});

fs.writeFileSync(file, content);
console.log('Replacements done.');
