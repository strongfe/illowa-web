import Header from '@/components/Header';
import Hero from '@/components/Hero';
import StatsBar from '@/components/StatsBar';
import About from '@/components/About';
import Rooms from '@/components/Rooms';
import Rates from '@/components/Rates';
import Amenities from '@/components/Amenities';
import Snackbar from '@/components/Snackbar';
import Bathroom from '@/components/Bathroom';
import Business from '@/components/Business';
import ChineseSection from '@/components/ChineseSection';
import Gallery from '@/components/Gallery';
import Information from '@/components/Information';
import BookingCTA from '@/components/BookingCTA';
import Footer from '@/components/Footer';

export default function HomePage() {
  return (
    <main>
      <Header />
      <Hero />
      <StatsBar />
      <About />
      <Rooms />
      <Rates />
      <Amenities />
      <Snackbar />
      <Bathroom />
      <Business />
      <ChineseSection />
      <Gallery />
      <Information />
      <BookingCTA />
      <Footer />
    </main>
  );
}
