import React, { useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, Text, TouchableOpacity, View } from 'react-native';
import { Href, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeProvider';
import { storeRepository } from '../../db/repositories/store.repository';
import { KeyboardAwareScrollView } from '../KeyboardAwareScrollView';
import { StoreButton } from '../StoreForm';
import { LessonId, lessons, readTutorialProgress, TUTORIAL_PROGRESS_KEY } from './lessons';
import { TutorialPractice } from './TutorialPractice';

export default function TutorialScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [active, setActive] = useState<LessonId | null>(null);
  const [completed, setCompleted] = useState<LessonId[]>([]);
  const [ready, setReady] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const completedRef = useRef<LessonId[]>([]);
  const writes = useRef(Promise.resolve());
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    storeRepository.setting(TUTORIAL_PROGRESS_KEY).then(value => {
      if (mounted.current) { completedRef.current = readTutorialProgress(value); setCompleted(completedRef.current); }
    }).catch(() => { if (mounted.current) setSaveError(true); })
      .finally(() => { if (mounted.current) setReady(true); });
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    if (!active) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { setActive(null); return true; });
    return () => subscription.remove();
  }, [active]);

  const save = (next: LessonId[]) => {
    completedRef.current = next; setCompleted(next);
    writes.current = writes.current.then(() => storeRepository.setSetting(TUTORIAL_PROGRESS_KEY, JSON.stringify(next)))
      .then(() => { if (mounted.current) setSaveError(false); })
      .catch(() => { if (mounted.current) setSaveError(true); });
  };
  const open = (id: LessonId) => { setAttempt(value => value + 1); setActive(id); };
  const index = lessons.findIndex(lesson => lesson.id === active);
  const lesson = index >= 0 ? lessons[index] : null;
  const done = !!active && completed.includes(active);
  const nextLesson = lessons.find(item => !completed.includes(item.id)) ?? lessons[0];
  const text = { color: colors.ink, fontSize: 15, lineHeight: 23 };

  return <KeyboardAwareScrollView key={active ?? 'overview'} style={{ flex: 1, backgroundColor: colors.paper }}
    contentContainerStyle={{ width: '100%', maxWidth: 720, alignSelf: 'center', padding: 20, paddingBottom: 48, gap: 18 }}>
    {saveError && <View style={{ padding: 12, gap: 8, backgroundColor: colors.warningSoft, borderRadius: 8 }}>
      <Text style={text}>Progress could not be saved or loaded. You can still practice.</Text>
      <StoreButton secondary label="Retry saving tutorial progress" onPress={() => save(completedRef.current)} />
    </View>}
    {lesson ? <>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="All tutorial lessons" onPress={() => setActive(null)} style={{ paddingVertical: 8, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Ionicons name="arrow-back" size={20} color={colors.accent} /><Text style={{ color: colors.accent, fontWeight: '600' }}>All lessons</Text>
      </TouchableOpacity>
      <View style={{ gap: 10 }}>
        <Text style={{ color: colors.muted, fontSize: 12, letterSpacing: 1 }}>LESSON {index + 1} OF {lessons.length}</Text>
        <Text accessibilityRole="header" style={{ color: colors.ink, fontFamily: 'serif', fontSize: 30 }}>{lesson.title}</Text>
        <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: lessons.length, now: index + 1 }} style={{ height: 5, backgroundColor: colors.line, borderRadius: 5 }}>
          <View style={{ height: 5, width: `${(index + 1) / lessons.length * 100}%`, borderRadius: 5, backgroundColor: colors.accent }} />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 10, padding: 14, backgroundColor: colors.accentSoft, borderRadius: 8 }}>
        <Ionicons name={done ? 'checkmark-circle' : 'hand-left-outline'} size={23} color={colors.accent} />
        <Text style={{ ...text, flex: 1 }}>{lesson.task}</Text>
      </View>
      <View style={{ borderWidth: 2, borderColor: colors.line, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.surface }}>
        <View style={{ padding: 14, backgroundColor: colors.soft, gap: 4 }}>
          <Text style={{ color: colors.ink, fontWeight: '600' }}>{lesson.screen}</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>PRACTICE SCREEN · SAMPLE DATA ONLY</Text>
        </View>
        <View style={{ padding: 12 }}><TutorialPractice key={`${lesson.id}-${attempt}`} lesson={lesson.id} onComplete={() => {
          if (!completedRef.current.includes(lesson.id)) save([...completedRef.current, lesson.id]);
        }} /></View>
      </View>
      <View style={{ paddingLeft: 14, borderLeftWidth: 3, borderLeftColor: colors.accent, gap: 5 }}>
        <Text style={{ color: colors.ink, fontWeight: '600' }}>In your real store</Text><Text style={text}>{lesson.tip}</Text>
      </View>
      <StoreButton label={index === lessons.length - 1 ? 'Finish tutorial' : 'Next lesson'} disabled={!done} onPress={() => {
        if (index === lessons.length - 1) setActive(null); else open(lessons[index + 1].id);
      }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <TouchableOpacity accessibilityRole="button" onPress={() => open(lesson.id)} style={{ paddingVertical: 10 }}><Text style={{ color: colors.accent }}>Restart practice</Text></TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" onPress={() => router.push(lesson.route as Href)} style={{ paddingVertical: 10 }}><Text style={{ color: colors.accent }}>Open real screen ↗</Text></TouchableOpacity>
      </View>
    </> : <>
      <View style={{ gap: 14, paddingVertical: 12 }}>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><Ionicons name="school-outline" size={24} color={colors.accent} /><Text style={{ color: colors.accent, letterSpacing: 1, fontSize: 12, fontWeight: '600' }}>LEARN BY DOING</Text></View>
        <Text accessibilityRole="header" style={{ color: colors.ink, fontFamily: 'serif', fontSize: 36, lineHeight: 42 }}>Your store,{ '\n' }step by step.</Text>
        <Text style={text}>Tap through ten short lessons with sample products, checkout, deliveries, and more. Your real inventory stays untouched.</Text>
      </View>
      <View style={{ backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.line, padding: 18, gap: 14 }}>
        <Text style={{ ...text, fontWeight: '600' }}>{completed.length === lessons.length ? 'You’re ready to run your store.' : `${completed.length} of ${lessons.length} lessons completed`}</Text>
        <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: lessons.length, now: completed.length }} style={{ height: 7, borderRadius: 7, backgroundColor: colors.soft }}>
          <View style={{ height: 7, width: `${completed.length / lessons.length * 100}%`, backgroundColor: colors.success, borderRadius: 7 }} />
        </View>
        <StoreButton label={!ready ? 'Loading progress…' : completed.length === lessons.length ? 'Practice again' : completed.length ? 'Continue tutorial' : 'Start tutorial'} disabled={!ready} onPress={() => open(nextLesson.id)} />
      </View>
      <Text accessibilityRole="header" style={{ color: colors.ink, fontSize: 20, fontWeight: '600' }}>Choose a lesson</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 }}>
        {lessons.map((item, itemIndex) => <TouchableOpacity key={item.id} accessibilityRole="button" accessibilityLabel={`Lesson ${itemIndex + 1}: ${item.title}${completed.includes(item.id) ? ', completed' : ''}`}
          disabled={!ready} onPress={() => open(item.id)} style={{ width: '48%', minHeight: 142, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, padding: 14, borderRadius: 10, gap: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Ionicons name={item.icon} size={26} color={colors.accent} />
            {completed.includes(item.id) ? <Ionicons name="checkmark-circle" size={20} color={colors.success} /> : <Text style={{ color: colors.muted }}>{String(itemIndex + 1).padStart(2, '0')}</Text>}</View>
          <Text style={{ color: colors.ink, fontSize: 16, fontWeight: '600', lineHeight: 22 }}>{item.title}</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>Try it →</Text>
        </TouchableOpacity>)}
      </View>
      {!!completed.length && <StoreButton secondary label="Reset tutorial progress" onPress={() => Alert.alert('Reset tutorial progress?', 'This only resets lesson checkmarks. Your inventory and sales stay unchanged.', [
        { text: 'Cancel', style: 'cancel' }, { text: 'Reset lessons', onPress: () => save([]) },
      ])} />}
    </>}
  </KeyboardAwareScrollView>;
}
