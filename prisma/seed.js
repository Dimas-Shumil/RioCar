import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const cars = [
  {
    title: 'Toyota Land Cruiser 200',
    slug: 'toyota-land-cruiser-200',
    category: 'PREMIUM',
    year: 2016,
    engine: '4.6 л / 309 л.с.',
    mileage: 'Без ограничений',
    drive: 'Полный',
    gearbox: 'Автомат',
    fuel: 'Бензин',
    bodyType: 'Внедорожник',
    seats: 5,
    complectation: 'Комфорт, климат-контроль и камера заднего вида',
    rentalTerms:
      'Залог: 15 000 ₽. 20 дней и более — 12 750 ₽ в сутки; 10–19 дней — 13 500 ₽; 5–9 дней — 14 250 ₽; 1–4 дня — 15 000 ₽. Расход топлива: 17–22 л/100 км.',
    description:
      'Представительский внедорожник для дальних маршрутов, поездок большой компанией и путешествий по Хакасии. Высокая посадка, просторный салон и уверенное поведение на трассе.',
    features: [
      'Полный привод',
      'Климат-контроль',
      'Камера заднего вида',
      'Просторный салон',
      'Подходит для дальних поездок',
      'Автоматическая коробка передач',
    ],
    minRentalDays: 1,
    pricePerDay: 12750,
    deposit: 15000,
    sortOrder: 10,
    images: [
      '/site/image/cars/blackCruiser/IMG_3751.JPG.webp',
      '/site/image/cars/blackCruiser/IMG_3750.JPG.webp',
    ],
  },
  {
    title: 'Toyota Land Cruiser 200 с водителем',
    slug: 'toyota-land-cruiser-200-s-voditelem',
    category: 'PREMIUM',
    year: 2021,
    engine: '4.6 л / 309 л.с.',
    mileage: 'По маршруту',
    drive: 'Полный',
    gearbox: 'Автомат',
    fuel: 'Бензин',
    bodyType: 'Внедорожник',
    seats: 5,
    complectation: 'Премиальный автомобиль с личным водителем',
    rentalTerms:
      'Без залога. Стоимость автомобиля — от 17 000 ₽ в сутки, услуги водителя — от 5 500 ₽ в день. Отдельно оплачиваются топливо, питание и проживание водителя при дальних маршрутах.',
    description:
      'Комфортное решение для деловых поездок, трансферов и путешествий, когда хочется полностью сосредоточиться на маршруте и отдыхе.',
    features: [
      'Профессиональный водитель',
      'Полный привод',
      'Климат-контроль',
      'Просторный салон',
      'Подходит для трансферов',
      'Индивидуальный маршрут',
    ],
    minRentalDays: 1,
    pricePerDay: 22500,
    deposit: 0,
    sortOrder: 20,
    images: [
      '/site/image/cars/whiteCruiser/frontCruiserW.jpg',
      '/site/image/cars/whiteCruiser/backCruiserW.webp',
    ],
  },
  {
    title: 'Mercedes-Benz E 300',
    slug: 'mercedes-benz-e-300',
    category: 'PREMIUM',
    year: 2015,
    engine: '3.0 л / 250 л.с.',
    mileage: 'Без ограничений',
    drive: 'Полный',
    gearbox: 'Автомат',
    fuel: 'Бензин',
    bodyType: 'Седан',
    seats: 5,
    complectation: 'Кондиционер, подогрев сидений и комфортный салон',
    rentalTerms:
      'Залог: 15 000 ₽. 30 дней и более — 7 380 ₽ в сутки; 20–29 дней — 7 650 ₽; 10–19 дней — 8 100 ₽; 5–9 дней — 8 550 ₽; 1–4 дня — 9 000 ₽. Расход топлива: 13–15 л/100 км.',
    description:
      'Элегантный полноприводный седан для деловых встреч, городских поездок и уверенных путешествий по трассе. Комфортный салон и сдержанный премиальный характер подходят для любого маршрута.',
    features: [
      'Полный привод',
      'Подогрев сидений',
      'Кондиционер',
      'Комфортный салон',
      'Автоматическая коробка передач',
      'Подходит для деловых поездок',
    ],
    minRentalDays: 1,
    pricePerDay: 7380,
    deposit: 15000,
    sortOrder: 30,
    images: [
      '/site/image/cars/benxE300/WhatsApp_Image_2024-.jpeg.webp',
      '/site/image/cars/benxE300/WhatsApp_Image_2024-.jpeg (1).webp',
    ],
  },
  {
    title: 'Toyota Camry 2019',
    slug: 'toyota-camry-2019',
    category: 'PREMIUM',
    year: 2019,
    engine: '2.0 л / 181 л.с.',
    mileage: 'Без ограничений',
    drive: 'Передний',
    gearbox: 'Автомат',
    fuel: 'Бензин',
    bodyType: 'Седан',
    seats: 5,
    complectation: 'Бизнес-класс и ассистенты вождения',
    rentalTerms:
      'Залог: 15 000 ₽. 30 дней и более — 6 150 ₽ в сутки; 20–29 дней — 6 375 ₽; 10–19 дней — 6 750 ₽; 5–9 дней — 7 125 ₽; 1–4 дня — 7 500 ₽.',
    description:
      'Современный бизнес-седан с просторным салоном. Подходит для деловых встреч, поездок по городу и комфортных маршрутов по Хакасии.',
    features: [
      'Бизнес-класс',
      'Климатическая система',
      'Просторный салон',
      'Автоматическая коробка передач',
      'Экономичный двигатель',
      'Комфорт на трассе',
    ],
    minRentalDays: 1,
    pricePerDay: 6150,
    deposit: 15000,
    sortOrder: 40,
    images: [
      '/site/image/cars/camryBlack2019/Frontcamry2019.png',
      '/site/image/cars/camryBlack2019/backcamry2019.png',
    ],
  },
  {
    title: 'Toyota Camry 2013',
    slug: 'toyota-camry-2013',
    category: 'COMFORT',
    year: 2013,
    engine: '2.5 л / 181 л.с.',
    mileage: 'Без ограничений',
    drive: 'Передний',
    gearbox: 'Автомат',
    fuel: 'Бензин',
    bodyType: 'Седан',
    seats: 5,
    complectation: 'Просторный салон и кондиционер',
    rentalTerms:
      'Залог: 5 000 ₽. 30 дней и более — 4 920 ₽ в сутки; 20–29 дней — 5 100 ₽; 10–19 дней — 5 400 ₽; 5–9 дней — 5 700 ₽; 1–4 дня — 6 000 ₽.',
    description:
      'Надёжный и просторный седан комфорт-класса для города, трассы и семейных поездок.',
    features: [
      'Просторный салон',
      'Кондиционер',
      'Автоматическая коробка передач',
      'Передний привод',
      'Подходит для семьи',
      'Без ограничения пробега',
    ],
    minRentalDays: 1,
    pricePerDay: 4505,
    deposit: 5000,
    sortOrder: 50,
    images: [
      '/site/image/cars/camryBlack2013/FrontCamry2013.png',
      '/site/image/cars/camryBlack2013/BackCamry2013.png',
    ],
  },
  {
    title: 'Toyota Camry 2015',
    slug: 'toyota-camry-2015',
    category: 'COMFORT',
    year: 2015,
    engine: '2.5 л / 181 л.с.',
    mileage: 'Без ограничений',
    drive: 'Передний',
    gearbox: 'Автомат',
    fuel: 'Бензин',
    bodyType: 'Седан',
    seats: 5,
    complectation: 'Просторный салон и кондиционер',
    rentalTerms:
      'Залог: 5 000 ₽. 30 дней и более — 4 920 ₽ в сутки; 20–29 дней — 5 100 ₽; 10–19 дней — 5 400 ₽; 5–9 дней — 5 700 ₽; 1–4 дня — 6 000 ₽.',
    description:
      'Сбалансированный седан комфорт-класса для ежедневных поездок, командировок и путешествий.',
    features: [
      'Просторный салон',
      'Кондиционер',
      'Автоматическая коробка передач',
      'Передний привод',
      'Комфорт на трассе',
      'Без ограничения пробега',
    ],
    minRentalDays: 1,
    pricePerDay: 4920,
    deposit: 5000,
    sortOrder: 60,
    images: [
      '/site/image/cars/camryWhite/FrontCamry2015.png',
      '/site/image/cars/camryWhite/BackCamry2015.png',
    ],
  },
  {
    title: 'Toyota RAV4',
    slug: 'toyota-rav4',
    category: 'COMFORT',
    year: 2014,
    engine: '2.5 л / 180 л.с.',
    mileage: 'Без ограничений',
    drive: 'Полный',
    gearbox: 'Автомат',
    fuel: 'Бензин',
    bodyType: 'Кроссовер',
    seats: 5,
    complectation: 'Просторный салон и кондиционер',
    rentalTerms:
      'Залог: 5 000 ₽. 30 дней и более — 5 200 ₽ в сутки; 20–29 дней — 5 525 ₽; 10–19 дней — 5 850 ₽; 5–9 дней — 6 175 ₽; 1–4 дня — 6 500 ₽.',
    description:
      'Практичный полноприводный кроссовер для города, загородных дорог и маршрутов по природным местам Хакасии.',
    features: [
      'Полный привод',
      'Высокая посадка',
      'Просторный салон',
      'Кондиционер',
      'Автоматическая коробка передач',
      'Подходит для путешествий',
    ],
    minRentalDays: 1,
    pricePerDay: 5200,
    deposit: 5000,
    sortOrder: 70,
    images: [
      '/site/image/cars/rav4/fSCH03423.jpg.webp',
      '/site/image/cars/rav4/fSCH03421.jpg.webp',
    ],
  },
  {
    title: 'Toyota Camry 2017',
    slug: 'toyota-camry-2017',
    category: 'COMFORT',
    year: 2017,
    engine: '2.5 л / 180 л.с.',
    mileage: 'Без ограничений',
    drive: 'Передний',
    gearbox: 'Автомат',
    fuel: 'Бензин',
    bodyType: 'Седан',
    seats: 5,
    complectation: 'Просторный салон и кондиционер',
    rentalTerms:
      'Залог: 15 000 ₽. 30 дней и более — 6 150 ₽ в сутки; 20–29 дней — 6 375 ₽; 10–19 дней — 6 750 ₽; 5–9 дней — 7 125 ₽; 1–4 дня — 7 500 ₽.',
    description:
      'Комфортный седан для деловых и личных поездок. Просторный салон хорошо подходит для дальних маршрутов.',
    features: [
      'Просторный салон',
      'Кондиционер',
      'Автоматическая коробка передач',
      'Передний привод',
      'Комфорт на трассе',
      'Без ограничения пробега',
    ],
    minRentalDays: 1,
    pricePerDay: 6150,
    deposit: 15000,
    sortOrder: 80,
    images: [
      '/site/image/cars/camryBrown/WhatsApp_Image_2024-.jpeg',
      '/site/image/cars/camryBrown/_WhatsApp_2025-07-28.jpg.webp',
    ],
  },
  {
    title: 'Hyundai Solaris',
    slug: 'hyundai-solaris-2018',
    category: 'ECONOM',
    year: 2018,
    engine: '1.6 л / 123 л.с.',
    mileage: 'Без ограничений',
    drive: 'Передний',
    gearbox: 'Механика',
    fuel: 'Бензин',
    bodyType: 'Седан',
    seats: 5,
    complectation: 'Кондиционер и практичный городской салон',
    rentalTerms:
      'Залог: 5 000 ₽. 30 дней и более — 2 870 ₽ в сутки; 20–29 дней — 2 975 ₽; 10–19 дней — 3 150 ₽; 5–9 дней — 3 325 ₽; 1–4 дня — 3 500 ₽.',
    description:
      'Экономичный городской автомобиль для повседневных поездок по Абакану и коротких маршрутов по региону.',
    features: [
      'Экономичный двигатель',
      'Кондиционер',
      'Передний привод',
      'Удобен в городе',
      'Без ограничения пробега',
      'Вместительный багажник',
    ],
    minRentalDays: 1,
    pricePerDay: 2870,
    deposit: 5000,
    sortOrder: 90,
    images: [
      '/site/image/cars/SolarisBright/FrontSolatys2018.png',
      '/site/image/cars/SolarisBright/backSolarys2018.png',
    ],
  },
  {
    title: 'Kia Rio',
    slug: 'kia-rio-2018',
    category: 'ECONOM',
    year: 2018,
    engine: '1.6 л / 106 л.с.',
    mileage: 'Без ограничений',
    drive: 'Передний',
    gearbox: 'Механика',
    fuel: 'Бензин',
    bodyType: 'Седан',
    seats: 5,
    complectation: 'Кондиционер и практичный городской салон',
    rentalTerms:
      'Залог: 5 000 ₽. 30 дней и более — 2 870 ₽ в сутки; 20–29 дней — 2 975 ₽; 10–19 дней — 3 150 ₽; 5–9 дней — 3 325 ₽; 1–4 дня — 3 500 ₽.',
    description:
      'Компактный и экономичный автомобиль для города, рабочих поездок и ежедневной аренды.',
    features: [
      'Экономичный двигатель',
      'Кондиционер',
      'Передний привод',
      'Удобен в городе',
      'Без ограничения пробега',
      'Практичный салон',
    ],
    minRentalDays: 1,
    pricePerDay: 2870,
    deposit: 5000,
    sortOrder: 100,
    images: [
      '/site/image/cars/kiaRioBlue/fSCH03454.jpg.webp',
      '/site/image/cars/kiaRioBlue/fSCH03452.jpg.webp',
    ],
  },
  {
    title: 'Honda Stepwgn Spada',
    slug: 'honda-stepwgn-spada-2015',
    category: 'ECONOM',
    year: 2015,
    engine: '1.6 л / 150 л.с.',
    mileage: 'Без ограничений',
    drive: 'Передний',
    gearbox: 'Вариатор',
    fuel: 'Бензин',
    bodyType: 'Минивэн',
    seats: 7,
    complectation: 'Просторный салон, кондиционер и электродверь',
    rentalTerms:
      'Залог: 5 000 ₽. 30 дней и более — 6 150 ₽ в сутки; 20–29 дней — 6 375 ₽; 10–19 дней — 6 750 ₽; 5–9 дней — 7 125 ₽; 1–4 дня — 7 500 ₽.',
    description:
      'Вместительный минивэн для семьи, компании и поездок с большим количеством багажа.',
    features: [
      'Семь мест',
      'Просторный салон',
      'Электрическая дверь',
      'Кондиционер',
      'Вариатор',
      'Подходит для большой компании',
    ],
    minRentalDays: 1,
    pricePerDay: 6150,
    deposit: 5000,
    sortOrder: 110,
    images: [
      '/site/image/cars/Stepwgnh/frontSterp2015.png',
      '/site/image/cars/Stepwgnh/backStep2015.png',
    ],
  },
  {
    title: 'Toyota Camry 2010',
    slug: 'toyota-camry-2010',
    category: 'ECONOM',
    year: 2010,
    engine: '2.4 л / 167 л.с.',
    mileage: 'Без ограничений',
    drive: 'Передний',
    gearbox: 'Автомат',
    fuel: 'Бензин',
    bodyType: 'Седан',
    seats: 5,
    complectation: 'Просторный салон и кондиционер',
    rentalTerms:
      'Залог: 5 000 ₽. 30 дней и более — 3 600 ₽ в сутки; 20–29 дней — 3 825 ₽; 10–19 дней — 4 050 ₽; 5–9 дней — 4 275 ₽; 1–4 дня — 4 500 ₽.',
    description:
      'Проверенный временем седан для доступной аренды, городских задач и поездок по трассе.',
    features: [
      'Автоматическая коробка передач',
      'Кондиционер',
      'Просторный салон',
      'Передний привод',
      'Без ограничения пробега',
      'Доступная стоимость аренды',
    ],
    minRentalDays: 1,
    pricePerDay: 3600,
    deposit: 5000,
    sortOrder: 120,
    images: [
      '/site/image/cars/camryBlack2010/FrontCamry2010.png',
      '/site/image/cars/camryBlack2010/backCamry2010.png',
    ],
  },
];

async function main() {
  for (const item of cars) {
    const { images, features, ...data } = item;

    const car = await prisma.$transaction(async (transaction) => {
      const savedCar = await transaction.car.upsert({
        where: { slug: data.slug },
        update: {
          ...data,
          features: JSON.stringify(features),
          isActive: true,
        },
        create: {
          ...data,
          features: JSON.stringify(features),
          isActive: true,
        },
        select: { id: true, title: true },
      });

      await transaction.carImage.deleteMany({
        where: { carId: savedCar.id },
      });

      for (const [index, imagePath] of images.entries()) {
        await transaction.carImage.create({
          data: {
            carId: savedCar.id,
            imagePath,
            alt: `${data.title} — фото ${index + 1}`,
            isPrimary: index === 0,
            sortOrder: index,
          },
        });
      }

      return savedCar;
    });

    console.log(`Автомобиль готов: ${car.title}`);
  }

  console.log(`Готово. В базе ${cars.length} автомобилей.`);
}

main()
  .catch((error) => {
    console.error('Ошибка заполнения автомобилей:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
