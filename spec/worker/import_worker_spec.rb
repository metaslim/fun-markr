require 'spec_helper'
require 'sidekiq/testing'

RSpec.describe Markr::Worker::ImportWorker do
  let(:valid_xml) do
    <<~XML
      <mcq-test-results>
        <mcq-test-result scanned-on="2017-12-04T12:12:10+11:00">
          <first-name>KJ</first-name>
          <last-name>Alysander</last-name>
          <student-number>002299</student-number>
          <test-id>9863</test-id>
          <summary-marks available="20" obtained="13" />
        </mcq-test-result>
      </mcq-test-results>
    XML
  end

  let(:repository) { instance_double(Markr::Repository::TestResultRepository) }
  let(:aggregate_repository) { instance_double(Markr::Repository::AggregateRepository) }
  let(:test_result) do
    Markr::Model::TestResult.new(
      student_number: '002299',
      test_id: '9863',
      marks_available: 20,
      marks_obtained: 13
    )
  end

  before do
    Sidekiq::Testing.fake!
    allow(described_class).to receive(:repository).and_return(repository)
    allow(described_class).to receive(:aggregate_repository).and_return(aggregate_repository)
    allow(repository).to receive(:find_by_test_id).and_return([test_result])
    allow(aggregate_repository).to receive(:save)
  end

  after do
    Sidekiq::Worker.clear_all
  end

  describe '.perform_async' do
    it 'enqueues job' do
      expect {
        described_class.perform_async(valid_xml, 'text/xml+markr')
      }.to change(described_class.jobs, :size).by(1)
    end
  end

  describe '#perform' do
    it 'parses XML and saves results' do
      expect(repository).to receive(:save).with(
        an_object_having_attributes(
          student_number: '002299',
          test_id: '9863',
          marks_available: 20,
          marks_obtained: 13
        )
      )

      Sidekiq::Testing.inline! do
        described_class.perform_async(valid_xml, 'text/xml+markr')
      end
    end

    it 'computes and saves aggregates' do
      allow(repository).to receive(:save)
      expect(aggregate_repository).to receive(:save).with('9863', hash_including('mean', 'count'))

      Sidekiq::Testing.inline! do
        described_class.perform_async(valid_xml, 'text/xml+markr')
      end
    end

    it 'handles multiple results' do
      xml = <<~XML
        <mcq-test-results>
          <mcq-test-result>
            <student-number>001</student-number>
            <test-id>9863</test-id>
            <summary-marks available="20" obtained="15" />
          </mcq-test-result>
          <mcq-test-result>
            <student-number>002</student-number>
            <test-id>9863</test-id>
            <summary-marks available="20" obtained="18" />
          </mcq-test-result>
        </mcq-test-results>
      XML

      expect(repository).to receive(:save).twice

      Sidekiq::Testing.inline! do
        described_class.perform_async(xml, 'text/xml+markr')
      end
    end

    it 'raises error for invalid content type' do
      expect {
        Sidekiq::Testing.inline! do
          described_class.perform_async('{}', 'application/json')
        end
      }.to raise_error(Markr::Loader::UnsupportedContentTypeError)
    end

    it 'raises error for invalid XML' do
      expect {
        Sidekiq::Testing.inline! do
          described_class.perform_async('<invalid>', 'text/xml+markr')
        end
      }.to raise_error(Nokogiri::XML::SyntaxError)
    end
  end
end
