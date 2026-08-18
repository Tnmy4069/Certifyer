import satori from 'satori';
import fs from 'fs';

async function test() {
  const fontBuffer = fs.readFileSync('public/fonts/Inter-Regular.ttf');
  try {
    await satori(
      {
        type: 'div',
        props: {
          style: {
            position: 'absolute',
            left: 100,
            top: 100,
            width: 200,
            display: 'flex',
            justifyContent: 'center',
            fontFamily: 'Inter',
            fontSize: 24,
            fontWeight: 400,
            color: '#000000',
            letterSpacing: undefined,
          },
          children: 'Hello',
        },
      } as any,
      {
        width: 800,
        height: 600,
        fonts: [{ name: 'Inter', data: fontBuffer, weight: 400, style: 'normal' }],
      }
    );
    console.log("Success with undefined");
  } catch(e) {
    console.log("Failed with undefined", e.message);
  }

  try {
    await satori(
      {
        type: 'div',
        props: {
          style: {
            position: 'absolute',
            left: 100,
            top: 100,
            width: 200,
            display: 'flex',
            justifyContent: 'center',
            fontFamily: 'Inter',
            fontSize: 24,
            fontWeight: 400,
            color: '#000000',
          },
          children: 'Hello',
        },
      } as any,
      {
        width: 800,
        height: 600,
        fonts: [{ name: 'Inter', data: fontBuffer, weight: 400, style: 'normal' }],
      }
    );
    console.log("Success without undefined");
  } catch(e) {
    console.log("Failed without undefined", e.message);
  }
}
test();
