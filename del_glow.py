import codecs
p = r'D:\Projects\boro\src\renderer\src\App.tsx'
lines = codecs.open(p,'r','utf-8').read().splitlines()

# Find the glow div: starts with '<div' before 'top: dev.height / 2,'
start_idx = None
for i, line in enumerate(lines):
    if 'top: dev.height / 2,' in line:
        # walk back to find the opening '<div' line
        for j in range(i-1, max(0,i-15), -1):
            if lines[j].strip().startswith('<div'):
                start_idx = j
                break
        break

if start_idx is None:
    print('start not found')
    exit(0)

# Find the closing '/>' after the style block
end_idx = None
for i in range(start_idx, min(len(lines), start_idx+20)):
    if lines[i].strip() == '/>':
        end_idx = i
        break

if end_idx is None:
    print('end not found')
    exit(0)

# Remove those lines and any blank line after
new_lines = lines[:start_idx] + lines[end_idx+1:]
# Clean up potential double blank lines around the cut
while start_idx < len(new_lines) and new_lines[start_idx].strip() == '':
    start_idx += 1
codecs.open(p,'w','utf-8').write('\n'.join(new_lines))
print(f'removed lines {start_idx}-{end_idx}')
