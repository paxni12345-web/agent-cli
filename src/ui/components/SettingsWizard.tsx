import React, { useState } from 'react';
import { Box, Text, useApp } from 'ink';
import { Config } from '../../types/index.js';
import { ConfigLoader } from '../../config/ConfigLoader.js';
import { InputBox } from './InputBox.js';

interface SettingsWizardProps {
  initialConfig: Config;
  onComplete?: (config: Config) => void;
}

const PROVIDERS = ['anthropic', 'openai', 'openai-compatible'];

export const SettingsWizard: React.FC<SettingsWizardProps> = ({ initialConfig, onComplete }) => {
  const { exit } = useApp();
  const [config, setConfig] = useState(initialConfig);
  const [step, setStep] = useState<'provider' | 'apiKey' | 'model' | 'baseUrl' | 'saving' | 'done'>('provider');
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  const submit = async (raw: string) => {
    const input = raw.trim();
    setValue('');
    setError('');
    if (step === 'provider') {
      const provider = input.toLowerCase();
      if (!PROVIDERS.includes(provider)) {
        setError(`เลือก provider: ${PROVIDERS.join(', ')}`);
        return;
      }
      setConfig(current => ({ ...current, provider, apiKey: provider === current.provider ? current.apiKey : undefined }));
      setStep('apiKey');
      return;
    }
    if (step === 'apiKey') {
      if (!input && !config.apiKey) {
        setError('กรุณาใส่ API key');
        return;
      }
      setConfig(current => ({ ...current, apiKey: input || current.apiKey }));
      setStep('model');
      return;
    }
    if (step === 'model') {
      if (!input) {
        setError('กรุณาใส่ชื่อ model');
        return;
      }
      setConfig(current => ({ ...current, model: input }));
      setStep('baseUrl');
      return;
    }
    if (step === 'baseUrl') {
      const updated = { ...config, baseUrl: input || undefined };
      setStep('saving');
      try {
        const loader = new ConfigLoader();
        await loader.save({
          provider: updated.provider,
          model: updated.model,
          apiKey: updated.apiKey,
          baseUrl: updated.baseUrl,
          permissionMode: updated.permissionMode,
          maxIterations: updated.maxIterations,
          temperature: updated.temperature,
          debug: updated.debug,
        }, true);
        setConfig(updated);
        setStep('done');
        if (onComplete) onComplete(updated);
        else setTimeout(() => exit(), 900);
      } catch (saveError) {
        setStep('baseUrl');
        setError(saveError instanceof Error ? saveError.message : 'บันทึก config ไม่สำเร็จ');
      }
    }
  };

  const prompt = {
    provider: 'Provider (anthropic / openai / openai-compatible)',
    apiKey: 'API key (ซ่อนข้อความขณะพิมพ์)',
    model: 'Model name',
    baseUrl: 'Base URL (เว้นว่างถ้าใช้ค่าเริ่มต้น)',
    saving: 'กำลังบันทึกการตั้งค่า…',
    done: 'บันทึกแล้ว เริ่มใช้งาน IRIS ได้เลย',
  }[step];

  return (
    <Box flexDirection="column" height="100%">
      <Box height={3} paddingX={1} alignItems="center">
        <Box paddingX={2} height={2}><Text backgroundColor="#252525" color="#e9d5ff" bold>▣  IRIS Settings</Text></Box>
        <Box flexGrow={1} />
        <Text color="#c4b5fd">─   □   ×</Text>
      </Box>
      <Box flexGrow={1} flexDirection="column" justifyContent="center" alignItems="center">
        <Text color="#c084fc" bold>{`██╗██████╗ ██╗███████╗`}</Text>
        <Text color="#c084fc" bold>{`██║██╔══██╗██║██╔════╝`}</Text>
        <Text color="#e9d5ff" bold>{`██║██║  ██║██║███████║`}</Text>
        <Box marginTop={1} marginBottom={2}><Text color="#e9d5ff" bold>IRIS · Quick setup</Text></Box>
        <Box width={Math.min(86, Math.max(42, (process.stdout.columns || 90) - 4))} flexDirection="column" borderStyle="round" borderColor="#a78bfa" paddingX={2} paddingY={1}>
          <Text color="#d8b4fe">Step {['provider', 'apiKey', 'model', 'baseUrl'].indexOf(step) + 1} of 4</Text>
          <Text color="#f3e8ff" bold>{prompt}</Text>
          {step === 'provider' && <Text color="#9f8aac">Current: {config.provider}</Text>}
          {step === 'apiKey' && config.apiKey && <Text color="#9f8aac">A key is already saved; press Enter to keep it.</Text>}
          {step === 'model' && <Text color="#9f8aac">Example: claude-sonnet-4-20250514 or gpt-4o</Text>}
          {step === 'baseUrl' && <Text color="#9f8aac">For compatible/custom endpoints only.</Text>}
          {step === 'saving' || step === 'done' ? <Text color="#d8b4fe">{prompt}</Text> : (
            <InputBox value={value} onChange={setValue} onSubmit={submit} placeholder={step === 'apiKey' ? 'Paste API key…' : 'Type value and press Enter…'} welcome secure={step === 'apiKey'} />
          )}
          {error ? <Text color="#fda4af">{error}</Text> : null}
        </Box>
        <Text color="#8b7a9e" dimColor>Settings are saved locally in ~/.agent/config.json</Text>
      </Box>
    </Box>
  );
};
