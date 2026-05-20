import codecs
p = r'D:\Projects\boro\src\renderer\src\App.tsx'
t = codecs.open(p,'r','utf-8').read()
t = t.replace('left: -20,', 'top: dev.height / 2,')
t = t.replace('top: -20,', 'left: dev.width / 2,')
t = t.replace('width: dev.width + 40,', 'width: 300,')
t = t.replace('height: dev.height + 40,', 'height: 300,')
t = t.replace("transform: isHitting && isOn ? 'scale(1)' : 'scale(0.75)',", "transform: `translate(-50%, -50%) scale(${isHitting && isOn ? 2.5 : 1})`,")
codecs.open(p,'w','utf-8').write(t)
print('glow ok')
