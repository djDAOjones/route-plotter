// V31-APP-PACK starter, editor, emptied by STACK-02: Carbon React renders one blank page and nothing else. The
// starter's canvas host, frame loop and shortcut dispatcher are left out: a still page queues no animation frame, and a
// control that does nothing is not shown. CORE-05 builds the editor shell here; nothing in it draws or saves yet.
// Stage 5: the page's one session, one keydown listener for the editor's keys, the live region the session's
// announcements are written to (visually hidden, empty at rest), and Help: its button, always on the page after the
// paragraph (a plain Carbon button until the frame's header comes), and its dialog, opened also by `?`.
import { Button, Content, Heading, Link } from '@carbon/react';
import { useEffect, useRef, useState } from 'react';
import { Help } from './shell/Help';
import { listenForKeys, MAC } from './shell/keydown';
import { holdRegion, pageSession } from './shell/session';

export function App() {
  const [helpOpen, setHelpOpen] = useState(false);
  const helpButton = useRef<HTMLButtonElement>(null);
  useEffect(
    () =>
      listenForKeys(pageSession(), () => {
        setHelpOpen(true);
      }),
    [],
  );
  return (
    <Content>
      <Heading>Route Plotter</Heading>
      <p>
        Version 4 is being built here. It cannot make anything yet. Its progress is on{' '}
        <Link inline href="https://github.com/djDAOjones/route-plotter">GitHub</Link>.
      </p>
      <Button
        id="help"
        ref={helpButton}
        onClick={() => {
          setHelpOpen(true);
        }}
      >
        Help
      </Button>
      <div role="status" aria-live="polite" className="cds--visually-hidden" ref={holdRegion} />
      <Help
        opener={helpButton}
        open={helpOpen}
        onClose={() => {
          setHelpOpen(false);
        }}
        mac={MAC}
        singleKeys={pageSession().singleKeys}
      />
    </Content>
  );
}
