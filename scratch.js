const fs = require('fs');

const file = '/home/raiga/preMSC/T-DEV-600-LIL_10/frontend/components/layout/ServerChannelsSidebar.tsx';
let content = fs.readFileSync(file, 'utf8');

const replacements = [
  { regex: /bg-\[#2f3136\]/g, replace: 'bg-sidebar' },
  { regex: /border-\[#202225\]/g, replace: 'border-border' },
  { regex: /hover:bg-\[#34373c\]/g, replace: 'hover:bg-sidebar-accent' },
  { regex: /text-white/g, replace: 'text-foreground' },
  { regex: /bg-\[#18191c\]/g, replace: 'bg-popover' },
  { regex: /text-\[#b9bbbe\]/g, replace: 'text-muted-foreground' },
  { regex: /focus:bg-\[#5865F2\]/g, replace: 'focus:bg-primary' },
  { regex: /focus:text-white/g, replace: 'focus:text-primary-foreground' },
  { regex: /text-\[#8e9297\]/g, replace: 'text-muted-foreground' },
  { regex: /hover:text-\[#dcddde\]/g, replace: 'hover:text-foreground' },
  { regex: /bg-black/g, replace: 'bg-popover' },
  { regex: /bg-\[#36393f\]/g, replace: 'bg-card' },
  { regex: /text-\[#dcddde\]/g, replace: 'text-card-foreground' },
  { regex: /bg-\[#4f545c\]\/60/g, replace: 'bg-primary' },
  { regex: /bg-\[#4f545c\]\/40/g, replace: 'bg-accent' },
  { regex: /hover:bg-\[#4f545c\]\/20/g, replace: 'hover:bg-accent/50' },
  { regex: /border-\[#5865F2\]/g, replace: 'border-primary' },
  { regex: /border-\[#72767d\]/g, replace: 'border-muted-foreground' },
  { regex: /bg-\[#5865F2\]/g, replace: 'bg-primary' },
  { regex: /hover:bg-\[#4752c4\]/g, replace: 'hover:bg-primary/90' },
  { regex: /bg-\[#1e1f22\]/g, replace: 'bg-input' },
  { regex: /focus-visible:ring-\[#5865F2\]/g, replace: 'focus-visible:ring-primary' },
  { regex: /bg-\[#393c43\]/g, replace: 'bg-sidebar-accent' },
  { regex: /text-\[#ED4245\]/g, replace: 'text-destructive' },
  { regex: /hover:text-\[#ED4245\]/g, replace: 'hover:text-destructive' },
  { regex: /border-\[#57F287\]/g, replace: 'border-emerald-500' },
  { regex: /text-\[#ed4245\]/g, replace: 'text-destructive' },
  { regex: /hover:bg-\[#ed4245\]\/10/g, replace: 'hover:bg-destructive/10' },
  { regex: /border-\[#ed4245\]\/50/g, replace: 'border-destructive/50' },
  { regex: /bg-\[#ed4245\]\/5/g, replace: 'bg-destructive/5' }
];

replacements.forEach(({ regex, replace }) => {
  content = content.replace(regex, replace);
});

fs.writeFileSync(file, content);
console.log('Replacements done.');
