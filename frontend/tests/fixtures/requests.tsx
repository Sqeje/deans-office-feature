import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { RequestsPage } from '../../src/modules/requests/Page';
import { demoSource, requestExamples, type DemoSource } from '../../src/modules/requests/model';
import '../../src/style.css';
const state = new URLSearchParams(location.search).get('state'); let calls = 0;
const source: DemoSource = { load: () => state === 'loading' ? new Promise(() => { }) : state === 'empty' ? Promise.resolve([]) : state === 'error' && calls++ === 0 ? Promise.reject(new Error()) : Promise.resolve(requestExamples), create: input => state === 'send-error' && calls++ === 0 ? Promise.reject(new Error()) : demoSource.create(input) };
createRoot(document.getElementById('root')!).render(<MemoryRouter initialEntries={[state === 'send-error' ? '/student/requests?view=create' : '/student/requests']}><RequestsPage source={source} /></MemoryRouter>);
