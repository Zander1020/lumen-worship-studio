import type {
 AppSettings,
 BibleVerse,
 MediaBackground,
 ProjectionTheme,
 ScheduleItem,
 Song
} from '../../shared/models'
import { songToSlides, versesToSlides } from '../../shared/slideHelpers'

export const DEFAULT_MEDIA_BACKGROUND: MediaBackground = {
 id: 'bg-aurora-gold',
 name: 'Aurora Dorada',
 kind: 'gradient',
 value: 'radial-gradient(circle at 20% 20%, #3b2a10 0%, #121629 55%, #070911 100%)',
 accentColor: '#f2b84b'
}

export const DEFAULT_MEDIA_BACKGROUNDS: readonly MediaBackground[] = [
 {
 id: 'bg-video-aurora',
 name: '🎬 Video: Aurora Boreal',
 kind: 'video',
 value: 'motion:aurora',
 accentColor: '#38bdf8'
 },
 {
 id: 'bg-video-particles',
 name: '🎬 Video: Partículas de Oro',
 kind: 'video',
 value: 'motion:particles',
 accentColor: '#facc15'
 },
 {
 id: 'bg-video-rays',
 name: '🎬 Video: Rayos de Gloria',
 kind: 'video',
 value: 'motion:rays',
 accentColor: '#60a5fa'
 },
 {
 id: 'bg-video-nebula',
 name: '🎬 Video: Nebulosa Cósmica',
 kind: 'video',
 value: 'motion:nebula',
 accentColor: '#c084fc'
 },
 {
 id: 'bg-video-ocean',
 name: '🎬 Video: Océano de Gracia',
 kind: 'video',
 value: 'motion:ocean',
 accentColor: '#06b6d4'
 },
 {
 id: 'bg-video-fire',
 name: '🎬 Video: Fuego Santo',
 kind: 'video',
 value: 'motion:fire',
 accentColor: '#f97316'
 },
 {
 id: 'bg-video-stars',
 name: '🎬 Video: Cielo Estrellado',
 kind: 'video',
 value: 'motion:stars',
 accentColor: '#a855f7'
 },
 {
 id: 'bg-video-sunset',
 name: '🎬 Video: Atardecer Celestial',
 kind: 'video',
 value: 'motion:sunset',
 accentColor: '#ec4899'
 },
 {
 id: 'bg-video-amber',
 name: '🎬 Video: Destellos Ámbar',
 kind: 'video',
 value: 'motion:amber',
 accentColor: '#eab308'
 },
 {
 id: 'bg-video-emerald',
 name: '🎬 Video: Manantial Esmeralda',
 kind: 'video',
 value: 'motion:emerald',
 accentColor: '#10b981'
 },
 DEFAULT_MEDIA_BACKGROUND,
 {
 id: 'bg-starlight-blue',
 name: 'Noche Estelar',
 kind: 'gradient',
 value: 'linear-gradient(135deg, #0b1528 0%, #162b4d 50%, #090d16 100%)',
 accentColor: '#58a6ff'
 },
 {
 id: 'bg-worship-ember',
 name: 'Fuego de Adoración',
 kind: 'gradient',
 value: 'radial-gradient(circle at 75% 25%, #4a1c1c 0%, #1f1124 60%, #09070d 100%)',
 accentColor: '#ff7b72'
 },
 {
 id: 'bg-emerald-grace',
 name: 'Esmeralda Celestial',
 kind: 'gradient',
 value: 'linear-gradient(150deg, #0a2924 0%, #0f1f2e 60%, #070a10 100%)',
 accentColor: '#3fb950'
 },
 {
 id: 'bg-royal-violet',
 name: 'Majestad Púrpura',
 kind: 'gradient',
 value: 'radial-gradient(circle at 50% 20%, #2d1b4e 0%, #141126 65%, #08070f 100%)',
 accentColor: '#bc8cff'
 },
 {
 id: 'bg-pure-black',
 name: 'Negro Puro (Alto Contraste)',
 kind: 'solid',
 value: '#000000',
 accentColor: '#ffffff'
 }
]

export const DEFAULT_THEME: ProjectionTheme = {
 background: DEFAULT_MEDIA_BACKGROUND,
 fontFamily: 'sans',
 fontScale: 100,
 autoFit: true,
 textAlign: 'center',
 textShadow: true,
 showFooter: false,
 mediaFit: 'contain'
}

export const DEFAULT_SETTINGS: AppSettings = {
 churchName: 'Lumen Studio',
 welcomeSubtitle: 'Bienvenidos al Servicio de Adoración',
 defaultProjectionTarget: 'auto',
 showClockOnLogo: true,
 remotePort: 4319,
 remotePin: '2468',
 theme: DEFAULT_THEME
}

export const DEFAULT_INITIAL_SONG: Song = {
 id: 'song-sublime-gracia',
 title: 'Sublime Gracia',
 author: 'John Newton (Dominio Público)',
 musicalKey: 'G',
 bpm: 72,
 tags: ['Gracia', 'Salvación', 'Himno', 'Adoración'],
 updatedAt: '2026-10-28T00:00:00.000Z',
 stanzas: [
 {
 id: 'sg-1',
 label: 'Verso 1',
 kind: 'verse',
 lines: [
 'Sublime gracia del Señor',
 'Que a un infeliz salvó;',
 'Fui ciego mas hoy veo yo,',
 'Perdido y Él me halló.'
 ]
 },
 {
 id: 'sg-2',
 label: 'Verso 2',
 kind: 'verse',
 lines: [
 'Su gracia me enseñó a temer,',
 'Mis dudas ahuyentó;',
 '¡Oh, cuán precioso fue a mi ser',
 'Cuando Él me transformó!'
 ]
 },
 {
 id: 'sg-3',
 label: 'Coro',
 kind: 'chorus',
 lines: [
 'De mis cadenas libre soy,',
 'Mi Salvador me rescató;',
 'Como un río fluye su merced,',
 'Sublime gracia y eterno amor.'
 ]
 },
 {
 id: 'sg-4',
 label: 'Verso 3',
 kind: 'verse',
 lines: [
 'En los peligros o aflicción',
 'Que yo he tenido aquí,',
 'Su gracia siempre me libró',
 'Y me guiará feliz.'
 ]
 }
 ]
}

export const DEFAULT_SONGS: readonly Song[] = [
 DEFAULT_INITIAL_SONG,
 {
 id: 'song-santo-santo-santo',
 title: 'Santo, Santo, Santo',
 author: 'Reginald Heber (Dominio Público)',
 musicalKey: 'D',
 bpm: 84,
 tags: ['Santidad', 'Apertura', 'Adoración', 'Trinidad'],
 updatedAt: '2026-10-28T00:00:00.000Z',
 stanzas: [
 {
 id: 'ss-1',
 label: 'Verso 1',
 kind: 'verse',
 lines: [
 '¡Santo! ¡Santo! ¡Santo! Señor Omnipotente,',
 'Siempre el labio mío loores te dará;',
 '¡Santo! ¡Santo! ¡Santo! Te adoro reverente,',
 'Dios en tres Personas, bendita Trinidad.'
 ]
 },
 {
 id: 'ss-2',
 label: 'Verso 2',
 kind: 'verse',
 lines: [
 '¡Santo! ¡Santo! ¡Santo! En numeroso coro,',
 'Santos escogidos te adoran sin cesar,',
 'De alegría llenos y sus coronas de oro',
 'Rinden ante el trono y el cristalino mar.'
 ]
 },
 {
 id: 'ss-3',
 label: 'Verso 3',
 kind: 'verse',
 lines: [
 '¡Santo! ¡Santo! ¡Santo! La gloria de tu nombre',
 'Vemos en tus obras en cielo, tierra y mar;',
 '¡Santo! ¡Santo! ¡Santo! Te adorará todo hombre,',
 'Dios en tres Personas, bendita Trinidad.'
 ]
 }
 ]
 },
 {
 id: 'song-castillo-fuerte',
 title: 'Castillo Fuerte Es Nuestro Dios',
 author: 'Martín Lutero (Dominio Público)',
 musicalKey: 'C',
 bpm: 90,
 tags: ['Fe', 'Fortaleza', 'Protección', 'Himno'],
 updatedAt: '2026-10-28T00:00:00.000Z',
 stanzas: [
 {
 id: 'cf-1',
 label: 'Verso 1',
 kind: 'verse',
 lines: [
 'Castillo fuerte es nuestro Dios,',
 'Defensa y buen escudo;',
 'Con su poder nos librará',
 'En todo trance agudo.'
 ]
 },
 {
 id: 'cf-2',
 label: 'Verso 2',
 kind: 'verse',
 lines: [
 'Nuestro valor es nada aquí,',
 'Con él todo es perdido;',
 'Mas con nosotros luchará',
 'De Dios el Escogido.'
 ]
 }
 ]
 },
 {
 id: 'song-roca-eternidad',
 title: 'Roca de la Eternidad',
 author: 'Augustus Toplady (Dominio Público)',
 musicalKey: 'Bb',
 bpm: 76,
 tags: ['Cruz', 'Refugio', 'Salvación', 'Comunión'],
 updatedAt: '2026-10-28T00:00:00.000Z',
 stanzas: [
 {
 id: 're-1',
 label: 'Verso 1',
 kind: 'verse',
 lines: [
 'Roca de la eternidad,',
 'Fuiste abierta para mí;',
 'Sé mi escondedero fiel,',
 'Solo encuentro paz en Ti.'
 ]
 },
 {
 id: 're-2',
 label: 'Verso 2',
 kind: 'verse',
 lines: [
 'Aunque fuese siempre fiel,',
 'Aunque llore sin cesar,',
 'Del pecado no podré',
 'Justificación lograr;',
 'Solo en Ti teniendo fe',
 'Deuda tal podré pagar.'
 ]
 }
 ]
 },
 {
 id: 'song-alabad-al-senor',
 title: 'Cantad Alegres a Dios',
 author: 'Salmo 100 (Tradicional)',
 musicalKey: 'E',
 bpm: 108,
 tags: ['Alabanza', 'Gozo', 'Gratitud', 'Apertura'],
 updatedAt: '2026-10-28T00:00:00.000Z',
 stanzas: [
 {
 id: 'ca-1',
 label: 'Verso 1',
 kind: 'verse',
 lines: [
 'Cantad alegres a Dios,',
 'Habitantes de toda la tierra;',
 'Servid a Jehová con alegría,',
 'Venid ante su presencia con regocijo.'
 ]
 },
 {
 id: 'ca-2',
 label: 'Coro',
 kind: 'chorus',
 lines: [
 'Porque Jehová es bueno;',
 'Para siempre es su misericordia,',
 'Y su verdad permanece',
 'Por todas las generaciones.'
 ]
 }
 ]
 }
]

export const DEFAULT_BIBLE_VERSES: readonly BibleVerse[] = [
 // Salmos 23
 { book: 'Salmos', chapter: 23, verse: 1, text: 'Jehová es mi pastor; nada me faltará.' },
 { book: 'Salmos', chapter: 23, verse: 2, text: 'En lugares de delicados pastos me hará descansar; junto a aguas de reposo me pastoreará.' },
 { book: 'Salmos', chapter: 23, verse: 3, text: 'Confortará mi alma; me guiará por sendas de justicia por amor de su nombre.' },
 { book: 'Salmos', chapter: 23, verse: 4, text: 'Aunque ande en valle de sombra de muerte, no temeré mal alguno, porque tú estarás conmigo; tu vara y tu cayado me infundirán aliento.' },
 { book: 'Salmos', chapter: 23, verse: 5, text: 'Aderezarás mesa delante de mí en presencia de mis angustiadores; ungiste mi cabeza con aceite; mi copa está rebosando.' },
 { book: 'Salmos', chapter: 23, verse: 6, text: 'Ciertamente el bien y la misericordia me seguirán todos los días de mi vida, y en la casa de Jehová moraré por largos días.' },
 // Salmos 91
 { book: 'Salmos', chapter: 91, verse: 1, text: 'El que habita al abrigo del Altísimo morará bajo la sombra del Omnipotente.' },
 { book: 'Salmos', chapter: 91, verse: 2, text: 'Diré yo a Jehová: Esperanza mía, y castillo mío; mi Dios, en quien confiaré.' },
 { book: 'Salmos', chapter: 91, verse: 4, text: 'Con sus plumas te cubrirá, y debajo de sus alas estarás seguro; escudo y adarga es su verdad.' },
 // Salmos 100
 { book: 'Salmos', chapter: 100, verse: 1, text: 'Cantad alegres a Dios, habitantes de toda la tierra.' },
 { book: 'Salmos', chapter: 100, verse: 2, text: 'Servid a Jehová con alegría; venid ante su presencia con regocijo.' },
 { book: 'Salmos', chapter: 100, verse: 3, text: 'Reconoced que Jehová es Dios; él nos hizo, y no nosotros a nosotros mismos; pueblo suyo somos, y ovejas de su prado.' },
 { book: 'Salmos', chapter: 100, verse: 4, text: 'Entrad por sus puertas con acción de gracias, por sus atrios con alabanza; alabadle, bendecid su nombre.' },
 { book: 'Salmos', chapter: 100, verse: 5, text: 'Porque Jehová es bueno; para siempre es su misericordia, y su verdad por todas las generaciones.' },
 // Salmos 150
 { book: 'Salmos', chapter: 150, verse: 1, text: 'Alabad a Dios en su santuario; alabadle en la magnificencia de su firmamento.' },
 { book: 'Salmos', chapter: 150, verse: 2, text: 'Alabadle por sus proezas; alabadle conforme a la muchedumbre de su grandeza.' },
 { book: 'Salmos', chapter: 150, verse: 6, text: 'Todo lo que respira alabe a JAH. Aleluya.' },
 // Isaías 40
 { book: 'Isaías', chapter: 40, verse: 28, text: '¿No has sabido, no has oído que el Dios eterno es Jehová, el cual creó los confines de la tierra? No desfallece, ni se fatiga con cansancio, y su entendimiento no hay quien lo alcance.' },
 { book: 'Isaías', chapter: 40, verse: 29, text: 'Él da esfuerzo al cansado, y multiplica las fuerzas al que no tiene ningunas.' },
 { book: 'Isaías', chapter: 40, verse: 31, text: 'Pero los que esperan a Jehová tendrán nuevas fuerzas; levantarán alas como las águilas; correrán, y no se cansarán; caminarán, y no se fatigarán.' },
 // Mateo 5
 { book: 'Mateo', chapter: 5, verse: 14, text: 'Vosotros sois la luz del mundo; una ciudad asentada sobre un monte no se puede esconder.' },
 { book: 'Mateo', chapter: 5, verse: 16, text: 'Así alumbre vuestra luz delante de los hombres, para que vean vuestras buenas obras, y glorifiquen a vuestro Padre que está en los cielos.' },
 // Juan 3
 { book: 'Juan', chapter: 3, verse: 16, text: 'Porque de tal manera amó Dios al mundo, que ha dado a su Hijo unigénito, para que todo aquel que en él cree, no se pierda, mas tenga vida eterna.' },
 { book: 'Juan', chapter: 3, verse: 17, text: 'Porque no envió Dios a su Hijo al mundo para condenar al mundo, sino para que el mundo sea salvo por él.' },
 // Juan 4
 { book: 'Juan', chapter: 4, verse: 23, text: 'Mas la hora viene, y ahora es, cuando los verdaderos adoradores adorarán al Padre en espíritu y en verdad; porque también el Padre tales adoradores busca que le adoren.' },
 { book: 'Juan', chapter: 4, verse: 24, text: 'Dios es Espíritu; y los que le adoran, en espíritu y en verdad es necesario que adoren.' },
 // Juan 14
 { book: 'Juan', chapter: 14, verse: 6, text: 'Jesús le dijo: Yo soy el camino, y la verdad, y la vida; nadie viene al Padre, sino por mí.' },
 { book: 'Juan', chapter: 14, verse: 27, text: 'La paz os dejo, mi paz os doy; yo no os la doy como el mundo la da. No se turbe vuestro corazón, ni tenga miedo.' },
 // Romanos 8
 { book: 'Romanos', chapter: 8, verse: 28, text: 'Y sabemos que a los que aman a Dios, todas las cosas les ayudan a bien, esto es, a los que conforme a su propósito son llamados.' },
 { book: 'Romanos', chapter: 8, verse: 31, text: '¿Qué, pues, diremos a esto? Si Dios es por nosotros, ¿quién contra nosotros?' },
 { book: 'Romanos', chapter: 8, verse: 38, text: 'Por lo cual estoy seguro de que ni la muerte, ni la vida, ni ángeles, ni principados, ni potestades, ni lo presente, ni lo por venir,' },
 { book: 'Romanos', chapter: 8, verse: 39, text: 'ni lo alto, ni lo profundo, ni ninguna otra cosa creada nos podrá separar del amor de Dios, que es en Cristo Jesús Señor nuestro.' },
 // Efesios 2
 { book: 'Efesios', chapter: 2, verse: 8, text: 'Porque por gracia sois salvos por medio de la fe; y esto no de vosotros, pues es don de Dios;' },
 { book: 'Efesios', chapter: 2, verse: 9, text: 'no por obras, para que nadie se gloríe.' },
 // Filipenses 4
 { book: 'Filipenses', chapter: 4, verse: 6, text: 'Por nada estéis afanosos, sino sean conocidas vuestras peticiones delante de Dios en toda oración y ruego, con acción de gracias.' },
 { book: 'Filipenses', chapter: 4, verse: 7, text: 'Y la paz de Dios, que sobrepasa todo entendimiento, guardará vuestros corazones y vuestros pensamientos en Cristo Jesús.' },
 { book: 'Filipenses', chapter: 4, verse: 13, text: 'Todo lo puedo en Cristo que me fortalece.' },
 // Hebreos 11
 { book: 'Hebreos', chapter: 11, verse: 1, text: 'Es, pues, la fe la certeza de lo que se espera, la convicción de lo que no se ve.' },
 // Apocalipsis 4
 { book: 'Apocalipsis', chapter: 4, verse: 8, text: 'Y los cuatro seres vivientes tenían cada uno seis alas, y alrededor y por dentro estaban llenos de ojos; y no cesaban día y noche de decir: Santo, santo, santo es el Señor Dios Todopoderoso, el que era, el que es, y el que ha de venir.' },
 { book: 'Apocalipsis', chapter: 4, verse: 11, text: 'Señor, digno eres de recibir la gloria y la honra y el poder; porque tú creaste todas las cosas, y por tu voluntad existen y fueron creadas.' }
]

export function createDefaultSchedule(): ScheduleItem[] {
 const firstSong = DEFAULT_INITIAL_SONG
 const psalm23 = DEFAULT_BIBLE_VERSES.filter((v) => v.book === 'Salmos' && v.chapter === 23)
 return [
 {
 id: 'sched-welcome',
 kind: 'announcement',
 title: 'Bienvenida y Apertura',
 subtitle: 'Aviso inicial del servicio',
 slides: [
 {
 id: 'slide-welcome-1',
 sourceKind: 'announcement',
 sourceTitle: 'Bienvenida',
 label: 'Bienvenida',
 lines: [
 '¡Bienvenidos a la Casa de Dios!',
 'Prepara tu corazón para adorar en espíritu y en verdad.'
 ],
 footer: 'Lumen Studio · Servicio General'
 }
 ]
 },
 {
 id: 'sched-song-1',
 kind: 'song',
 title: firstSong.title,
 subtitle: `${firstSong.author} · Tono ${firstSong.musicalKey}`,
 refId: firstSong.id,
 slides: songToSlides(firstSong)
 },
 {
 id: 'sched-bible-1',
 kind: 'bible',
 title: 'Salmos 23:1-6',
 subtitle: 'Lectura congregacional · Reina-Valera 1909',
 slides: versesToSlides(psalm23)
 }
 ]
}
