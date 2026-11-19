export const Panel = ({ ok }: { ok: boolean }): unknown => (
  <section className="path-list">
    <p>Add a waypoint here.</p>
    <button type="button" aria-label="Delete the node">x</button>
    {'Lines and points'}
    <span title={ok ? 'Show the edges' : `Hide the ${'guide'}`} className={ok ? 'path-a' : 'path-b'}>
      {ok ? 'node' : 'point'}
    </span>
    <button type="button" aria-label={'Delete waypoint'}>y</button>
  </section>
);
