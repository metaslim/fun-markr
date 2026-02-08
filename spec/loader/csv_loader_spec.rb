require 'spec_helper'

RSpec.describe Markr::Loader::CsvLoader do
  subject(:loader) { described_class.new }

  let(:valid_csv) do
    <<~CSV
      student_number,student_name,test_id,marks_available,marks_obtained,scanned_on
      002299,KJ Alysander,9863,20,13,2017-12-04T12:12:10+11:00
      002300,John Smith,9863,20,17,2017-12-04T12:15:00+11:00
    CSV
  end

  describe '#supported_content_type' do
    it 'returns text/csv+markr' do
      expect(loader.supported_content_type).to eq('text/csv+markr')
    end
  end

  describe '#validate' do
    context 'with valid CSV' do
      it 'returns true' do
        expect(loader.validate(valid_csv)).to be true
      end
    end

    context 'with malformed CSV' do
      it 'raises InvalidDocumentError' do
        csv = "a,b,c\n\"unclosed quote"
        expect { loader.validate(csv) }.to raise_error(
          Markr::Loader::InvalidDocumentError,
          /Invalid CSV/
        )
      end
    end

    context 'with missing required headers' do
      it 'raises InvalidDocumentError' do
        csv = "student_number,test_id\n002299,9863"
        expect { loader.validate(csv) }.to raise_error(
          Markr::Loader::InvalidDocumentError,
          /Missing required headers.*marks_available.*marks_obtained/
        )
      end
    end
  end

  describe '#parse' do
    context 'with valid CSV' do
      it 'returns array of TestResult objects' do
        results = loader.parse(valid_csv)
        expect(results).to all(be_a(Markr::Model::TestResult))
        expect(results.size).to eq(2)
      end

      it 'extracts student_number' do
        results = loader.parse(valid_csv)
        expect(results.first.student_number).to eq('002299')
        expect(results.last.student_number).to eq('002300')
      end

      it 'extracts student_name' do
        results = loader.parse(valid_csv)
        expect(results.first.student_name).to eq('KJ Alysander')
        expect(results.last.student_name).to eq('John Smith')
      end

      it 'extracts test_id' do
        results = loader.parse(valid_csv)
        expect(results.first.test_id).to eq('9863')
      end

      it 'extracts marks_available' do
        results = loader.parse(valid_csv)
        expect(results.first.marks_available).to eq(20)
      end

      it 'extracts marks_obtained' do
        results = loader.parse(valid_csv)
        expect(results.first.marks_obtained).to eq(13)
        expect(results.last.marks_obtained).to eq(17)
      end

      it 'extracts scanned_on timestamp' do
        results = loader.parse(valid_csv)
        expect(results.first.scanned_on).to eq('2017-12-04T12:12:10+11:00')
      end
    end

    context 'with optional fields missing' do
      let(:minimal_csv) do
        <<~CSV
          student_number,test_id,marks_available,marks_obtained
          002299,9863,20,13
        CSV
      end

      it 'parses successfully with nil optional fields' do
        results = loader.parse(minimal_csv)
        expect(results.size).to eq(1)
        expect(results.first.student_name).to be_nil
        expect(results.first.scanned_on).to be_nil
      end
    end

    context 'with missing required fields in row' do
      it 'raises InvalidDocumentError for missing student_number value' do
        csv = <<~CSV
          student_number,test_id,marks_available,marks_obtained
          ,9863,20,13
        CSV

        expect { loader.parse(csv) }.to raise_error(
          Markr::Loader::InvalidDocumentError,
          /Missing student_number/
        )
      end

      it 'raises InvalidDocumentError for missing test_id value' do
        csv = <<~CSV
          student_number,test_id,marks_available,marks_obtained
          002299,,20,13
        CSV

        expect { loader.parse(csv) }.to raise_error(
          Markr::Loader::InvalidDocumentError,
          /Missing test_id/
        )
      end

      it 'raises InvalidDocumentError for missing marks_available value' do
        csv = <<~CSV
          student_number,test_id,marks_available,marks_obtained
          002299,9863,,13
        CSV

        expect { loader.parse(csv) }.to raise_error(
          Markr::Loader::InvalidDocumentError,
          /Missing marks_available/
        )
      end
    end

    context 'with missing required headers' do
      it 'raises InvalidDocumentError' do
        csv = "student_number,test_id\n002299,9863"
        expect { loader.parse(csv) }.to raise_error(
          Markr::Loader::InvalidDocumentError,
          /Missing required headers/
        )
      end
    end

    context 'with empty CSV' do
      it 'returns empty array for headers only' do
        csv = "student_number,test_id,marks_available,marks_obtained\n"
        expect(loader.parse(csv)).to eq([])
      end
    end

    context 'with whitespace in values' do
      let(:csv_with_whitespace) do
        <<~CSV
          student_number,student_name,test_id,marks_available,marks_obtained
          002299 , KJ Alysander , 9863 ,20,13
        CSV
      end

      it 'strips whitespace from values' do
        results = loader.parse(csv_with_whitespace)
        expect(results.first.student_number).to eq('002299')
        expect(results.first.student_name).to eq('KJ Alysander')
        expect(results.first.test_id).to eq('9863')
      end
    end
  end
end
