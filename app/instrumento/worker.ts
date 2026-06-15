type NoteEvent = { startTimeSeconds: number; durationSeconds: number; pitchMidi: number; amplitude: number };

self.onmessage = async (e: MessageEvent<{ mono: Float32Array; modelUrl: string }>) => {
  const { mono, modelUrl } = e.data;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tf = await import('@tensorflow/tfjs') as any;
    await tf.setBackend('cpu');
    await tf.ready();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { BasicPitch, noteFramesToTime, addPitchBendsToNoteEvents, outputToNotesPoly } =
      await import('@spotify/basic-pitch') as any;

    const allFrames: number[][] = [], allOnsets: number[][] = [], allContours: number[][] = [];
    const bp = new BasicPitch(modelUrl);
    await bp.evaluateModel(
      mono,
      (f: number[][], o: number[][], c: number[][]) => {
        allFrames.push(...f); allOnsets.push(...o); allContours.push(...c);
      },
      (p: number) => self.postMessage({ type: 'progress', value: Math.round(p * 100) }),
    );

    const notes = noteFramesToTime(
      addPitchBendsToNoteEvents(
        allContours,
        outputToNotesPoly(allFrames, allOnsets, 0.25, 0.25, 5, true, null, null, false, 11),
      ),
    ) as NoteEvent[];

    self.postMessage({ type: 'done', notes });
  } catch (err) {
    self.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
