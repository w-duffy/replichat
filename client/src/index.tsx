/* eslint-disable @typescript-eslint/no-unused-vars */
import React, {useEffect, useRef, useState} from 'react';
import ReactDOM from 'react-dom/client';
import {Replicache, TEST_LICENSE_KEY, WriteTransaction} from 'replicache';
import {Message, MessageWithID} from 'shared';
import {useSubscribe} from 'replicache-react';
import Pusher from 'pusher-js';
import {nanoid} from 'nanoid';

async function init() {
  const licenseKey =
    import.meta.env.VITE_REPLICACHE_LICENSE_KEY || TEST_LICENSE_KEY;
  if (!licenseKey) {
    throw new Error('Missing VITE_REPLICACHE_LICENSE_KEY');
  }

  function Root() {
    const [r, setR] = useState<Replicache<any> | null>(null);

    useEffect(() => {
      console.log('updating replicache');
      const r = new Replicache({
        name: 'chat-user-id',
        licenseKey,
        mutators: {
          async createMessage(
            tx: WriteTransaction,
            {id, from, content, order}: MessageWithID,
          ) {
            await tx.set(`message/${id}`, {
              from,
              content,
              order,
            });
          },
        },
        pushURL: `/api/replicache/push`,
        pullURL: `/api/replicache/pull`,
        logLevel: 'debug',
      });
      setR(r);
      listen(r);
      return () => {
        void r.close();
      };
    }, []);

    const messages = useSubscribe(
      r,
      async tx => {
        const list = await tx
          .scan<Message>({prefix: 'message/'})
          .entries()
          .toArray();
        list.sort(([, {order: a}], [, {order: b}]) => a - b);
        return list;
      },
      {default: []},
    );

    const usernameRef = useRef<HTMLInputElement>(null);
    const contentRef = useRef<HTMLInputElement>(null);
    
    const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      let last: Message | null = null;
      if (messages.length) {
        const lastMessageTuple = messages[messages.length - 1];
        last = lastMessageTuple[1];
      }
      const order = (last?.order ?? 0) + 1;
      const username = usernameRef.current?.value ?? '';
      const content = contentRef.current?.value ?? '';

      await r?.mutate.createMessage({
        id: nanoid(),
        from: username,
        content,
        order,
      });

      if (contentRef.current) {
        contentRef.current.value = '';
      }
    };

    return (
      <div>
        <form onSubmit={onSubmit}>
          <input ref={usernameRef} required /> says:
          <input ref={contentRef} required /> <input type="submit" />
        </form>
        {messages.map(([k, v]) => (
          <div key={k}>
            <b>{v.from}: </b>
            {v.content}
          </div>
        ))}
      </div>
    );
  }

  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
      <Root />
    </React.StrictMode>,
  );
}

function listen(rep: Replicache) {
  // TODO: add logic to listen to changes on the server
}

await init();
