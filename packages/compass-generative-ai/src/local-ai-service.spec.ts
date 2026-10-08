import { expect } from 'chai';
import sinon from 'sinon';
import { createNoopLogger } from '@mongodb-js/compass-logging/provider';
import { createSandboxFromDefaultPreferences } from 'compass-preferences-model';
import type { PreferencesAccess } from 'compass-preferences-model';
import { LocalAiService } from './local-ai-service';

describe('LocalAiService', function () {
  let preferences: PreferencesAccess;
  let fetchStub: sinon.SinonStub;

  beforeEach(async function () {
    preferences = await createSandboxFromDefaultPreferences();
    fetchStub = sinon.stub(globalThis, 'fetch');
  });

  afterEach(function () {
    fetchStub.restore();
  });

  function service() {
    return new LocalAiService({
      endpoint: '/local-ai',
      apiURLPreset: 'cloud',
      atlasService: {} as any,
      preferences,
      logger: createNoopLogger(),
    });
  }

  function respond(status: object, text: string) {
    fetchStub.callsFake((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/status')) {
        return Promise.resolve(
          new Response(JSON.stringify(status), { status: 200 })
        );
      }
      return Promise.resolve(
        new Response(text, {
          status: 200,
          headers: { 'x-local-ai-model': 'test-model' },
        })
      );
    });
  }

  it('turns the model answer into a validated find query', async function () {
    respond(
      { enabled: true, model: 'test-model', loaded: true },
      "<filter>{ variable: 'cx_salaryv1' }</filter><project>{}</project><sort>{ instance: 1 }</sort><skip>0</skip><limit>0</limit>"
    );
    const result = await service().getQueryFromUserInput({
      userInput: 'the salary field',
      collectionName: 'fields',
      databaseName: 'devlms',
      signal: new AbortController().signal,
      requestId: 'r1',
      enableStorage: false,
    });
    expect(result.content.query.filter).to.equal("{variable:'cx_salaryv1'}");
    expect(result.content.query.sort).to.equal('{instance:1}');
    // the generate call carries the namespace so the server can add context
    const generateCall = fetchStub
      .getCalls()
      .find((c) => String(c.args[0]).endsWith('/generate'));
    expect(JSON.parse(generateCall!.args[1].body as string).namespace).to.equal(
      'devlms.fields'
    );
  });

  it('explains when no model is usable', async function () {
    respond(
      { enabled: true, model: null, requestedModel: 'qwen2.5-coder:7b' },
      ''
    );
    let error: Error | null = null;
    try {
      await service().getQueryFromUserInput({
        userInput: 'x',
        collectionName: 'c',
        databaseName: 'd',
        signal: new AbortController().signal,
        requestId: 'r2',
        enableStorage: false,
      });
    } catch (err) {
      error = err as Error;
    }
    expect(error?.message).to.match(/ollama pull qwen2.5-coder:7b/);
  });

  it('surfaces a model error embedded in the stream', async function () {
    respond(
      { enabled: true, model: 'm', loaded: true },
      '<error>context length exceeded</error>'
    );
    let error: Error | null = null;
    try {
      await service().getAggregationFromUserInput({
        userInput: 'x',
        collectionName: 'c',
        databaseName: 'd',
        signal: new AbortController().signal,
        requestId: 'r3',
        enableStorage: false,
      });
    } catch (err) {
      error = err as Error;
    }
    expect(error?.message).to.match(/context length exceeded/);
  });
});
